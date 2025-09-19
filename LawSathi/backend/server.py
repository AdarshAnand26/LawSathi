from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import asyncio
import io
import base64
import json

# AI and Document Processing imports
from emergentintegrations.llm.chat import LlmChat, UserMessage
import PyPDF2
import pytesseract
from PIL import Image
import tempfile
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="LawSathi API", description="Legal Assistant for Rural Communities")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure AI Chat
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Define Models
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message_type: str = "text"  # text, voice, document

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: str = "english"  # english, hindi

class ChatResponse(BaseModel):
    response: str
    session_id: str
    timestamp: datetime
    sources: List[str] = []

class DocumentUpload(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    filename: str
    extracted_text: str
    simplified_explanation: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Legal Knowledge Base System Message
LEGAL_SYSTEM_MESSAGE = """You are LawSathi, an expert legal assistant specializing in Indian laws, government schemes, and legal rights. Your mission is to help rural and low-literacy communities understand legal matters in simple, accessible language.

Core Responsibilities:
1. Answer ANY questions related to Indian laws, legal rights, government schemes, and legal procedures
2. Provide accurate, up-to-date information about Indian legal system
3. Explain complex legal concepts in simple, easy-to-understand language
4. Guide users on legal procedures, documentation, and their rights
5. Provide information about government schemes and benefits they're entitled to

Key Areas of Expertise:
- Constitutional Rights and Fundamental Rights
- Criminal Law and Procedures
- Civil Law and Property Rights
- Family Law (Marriage, Divorce, Inheritance)
- Labor Laws and Employment Rights
- Consumer Protection Laws
- Land and Property Laws
- Government Schemes (PM-KISAN, Aadhar, PDS, MGNREGA, etc.)
- Legal Aid and Free Legal Services
- Court Procedures and Documentation
- Police Procedures and Rights during Arrest
- Women's Rights and Protection Laws
- Child Rights and Protection
- Senior Citizen Rights
- Disability Rights
- Tribal Rights and Special Provisions

Guidelines:
- Always provide practical, actionable advice
- Use simple language avoiding legal jargon
- Include relevant sections/acts when helpful
- Suggest next steps and where to seek help
- Be empathetic and supportive
- If unsure about specific cases, recommend consulting a lawyer
- Focus on Indian law and context specifically

Remember: You are helping people who may have limited education or legal knowledge, so clarity and simplicity are crucial."""

# Helper Functions
async def get_ai_response(message: str, session_id: str, language: str = "english") -> str:
    """Get AI response for legal queries"""
    try:
        # Create AI chat instance
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=LEGAL_SYSTEM_MESSAGE
        ).with_model("openai", "gpt-4o")
        
        # Modify message based on language preference
        if language.lower() == "hindi":
            message = f"Please respond in simple Hindi (Devanagari script): {message}"
        else:
            message = f"Please respond in simple English: {message}"
        
        user_message = UserMessage(text=message)
        response = await chat.send_message(user_message)
        
        return response
    except Exception as e:
        logger.error(f"AI response error: {str(e)}")
        return "I apologize, but I'm having trouble processing your request right now. Please try again later."

async def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"PDF extraction error: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to extract text from PDF")

async def extract_text_from_image(file_content: bytes) -> str:
    """Extract text from image using OCR"""
    try:
        # Save image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
            temp_file.write(file_content)
            temp_file.flush()
            
            # Perform OCR
            image = Image.open(temp_file.name)
            text = pytesseract.image_to_string(image, lang='eng+hin')
            
            # Clean up
            os.unlink(temp_file.name)
            
            return text.strip()
    except Exception as e:
        logger.error(f"OCR extraction error: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to extract text from image")

# API Routes
@api_router.get("/")
async def root():
    return {"message": "LawSathi API - Legal Assistant for Rural Communities"}

@api_router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Main chat endpoint for legal Q&A"""
    try:
        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())
        
        # Get AI response
        ai_response = await get_ai_response(request.message, session_id, request.language)
        
        # Save to database
        chat_record = ChatMessage(
            session_id=session_id,
            message=request.message,
            response=ai_response,
            message_type="text"
        )
        await db.chat_messages.insert_one(chat_record.dict())
        
        return ChatResponse(
            response=ai_response,
            session_id=session_id,
            timestamp=datetime.utcnow(),
            sources=["Indian Legal Database", "Government Schemes Portal"]
        )
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process chat request")

@api_router.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    language: str = Form(default="english")
):
    """Upload and process legal documents"""
    try:
        # Validate file type
        allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Only PDF and image files are supported")
        
        # Read file content
        file_content = await file.read()
        
        # Extract text based on file type
        if file.content_type == 'application/pdf':
            extracted_text = await extract_text_from_pdf(file_content)
        else:
            extracted_text = await extract_text_from_image(file_content)
        
        if not extracted_text:
            raise HTTPException(status_code=400, detail="No text could be extracted from the document")
        
        # Get AI explanation
        explanation_prompt = f"""Analyze this legal document and provide a simplified explanation in {'Hindi' if language == 'hindi' else 'English'}:

Document Text:
{extracted_text}

Please provide:
1. What type of legal document this is
2. Key points and important information
3. What actions the person should take (if any)
4. Any deadlines or important dates
5. Rights and obligations mentioned
6. Whether legal consultation is recommended

Make the explanation simple and easy to understand for someone with limited legal knowledge."""
        
        ai_explanation = await get_ai_response(explanation_prompt, session_id, language)
        
        # Save to database
        doc_record = DocumentUpload(
            session_id=session_id,
            filename=file.filename,
            extracted_text=extracted_text,
            simplified_explanation=ai_explanation
        )
        await db.documents.insert_one(doc_record.dict())
        
        # Also save as chat message
        chat_record = ChatMessage(
            session_id=session_id,
            message=f"Uploaded document: {file.filename}",
            response=ai_explanation,
            message_type="document"
        )
        await db.chat_messages.insert_one(chat_record.dict())
        
        return {
            "message": "Document processed successfully",
            "extracted_text": extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
            "explanation": ai_explanation,
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process document")

@api_router.get("/chat-history/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).to_list(100)
        
        # Convert MongoDB documents to clean format
        clean_messages = []
        for msg in messages:
            clean_msg = {
                "id": msg.get("id", str(msg.get("_id", ""))),
                "session_id": msg.get("session_id", ""),
                "message": msg.get("message", ""),
                "response": msg.get("response", ""),
                "timestamp": msg.get("timestamp", ""),
                "message_type": msg.get("message_type", "text")
            }
            clean_messages.append(clean_msg)
        
        return {"messages": clean_messages}
    except Exception as e:
        logger.error(f"Chat history error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chat history: {str(e)}")

@api_router.get("/popular-topics")
async def get_popular_topics():
    """Get popular legal topics and quick queries"""
    topics = [
        {
            "category": "Constitutional Rights",
            "questions": [
                "What are my fundamental rights as an Indian citizen?",
                "How can I file a complaint if my rights are violated?",
                "What is the right to information (RTI)?"
            ]
        },
        {
            "category": "Government Schemes",
            "questions": [
                "How do I apply for PM-KISAN scheme?",
                "What documents do I need for Aadhar card?",
                "How to get a ration card?"
            ]
        },
        {
            "category": "Property & Land",
            "questions": [
                "How do I check my land records online?",
                "What is the process for property registration?",
                "What are my rights as a tenant?"
            ]
        },
        {
            "category": "Family & Marriage",
            "questions": [
                "What are the legal requirements for marriage?",
                "How do I file for divorce?",
                "What are women's rights in marriage?"
            ]
        },
        {
            "category": "Employment & Labor",
            "questions": [
                "What are my rights as an employee?",
                "How do I file a complaint against my employer?",
                "What is the minimum wage law?"
            ]
        }
    ]
    return {"topics": topics}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)