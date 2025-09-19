import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Bot, User, Lock, Mail, Languages } from 'lucide-react';

const Login = ({ onLogin, language, setLanguage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simple validation
    if (!email || !password) {
      setError(language === 'hindi' ? 'कृपया ईमेल और पासवर्ड दर्ज करें' : 'Please enter email and password');
      setIsLoading(false);
      return;
    }

    // For demo purposes, accept any email/password combination
    // In production, this would connect to a real authentication system
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Store user info (in production, this would be JWT tokens, etc.)
      const userData = {
        email: email,
        name: email.split('@')[0],
        loginTime: new Date().toISOString()
      };
      
      localStorage.setItem('lawsathi_user', JSON.stringify(userData));
      onLogin(userData);
    } catch (err) {
      setError(language === 'hindi' ? 'लॉगिन में त्रुटि हुई है' : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const demoUser = {
      email: 'demo@lawsathi.com',
      name: 'Demo User',
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('lawsathi_user', JSON.stringify(demoUser));
    onLogin(demoUser);
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <CardHeader className="login-header">
          <div className="login-logo">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {language === 'hindi' ? 'LawSathi में आपका स्वागत है' : 'Welcome to LawSathi'}
          </CardTitle>
          <p className="text-gray-600 mt-2">
            {language === 'hindi' 
              ? 'आपका व्यक्तिगत कानूनी सहायक' 
              : 'Your Personal Legal Assistant'}
          </p>
          
          {/* Language Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLanguage(language === 'english' ? 'hindi' : 'english')}
            className="mt-4 flex items-center space-x-2"
          >
            <Languages className="w-4 h-4" />
            <span>{language === 'english' ? 'हिंदी' : 'English'}</span>
          </Button>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder={language === 'hindi' ? 'ईमेल पता' : 'Email address'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 form-input"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="form-group">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder={language === 'hindi' ? 'पासवर्ड' : 'Password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 form-input"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {error && (
              <Alert className="mb-4">
                <AlertDescription className="text-red-600">{error}</AlertDescription>
              </Alert>
            )}
            
            <Button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {language === 'hindi' ? 'लॉग इन हो रहे हैं...' : 'Signing in...'}
                </div>
              ) : (
                language === 'hindi' ? 'लॉग इन करें' : 'Sign In'
              )}
            </Button>
            
            <div className="mt-4 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    {language === 'hindi' ? 'या' : 'or'}
                  </span>
                </div>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleDemoLogin}
              className="w-full mt-4"
              disabled={isLoading}
            >
              <User className="w-4 h-4 mr-2" />
              {language === 'hindi' ? 'डेमो के रूप में जारी रखें' : 'Continue as Demo User'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>
              {language === 'hindi' 
                ? '© 2024 LawSathi - ग्रामीण समुदायों के लिए कानूनी सहायता' 
                : '© 2024 LawSathi - Legal Assistance for Rural Communities'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;