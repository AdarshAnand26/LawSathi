import { FieldValues, Resolver } from 'react-hook-form';
import { StandardSchemaV1 } from 'zod/lib/standard-schema';
export declare function typeschemaResolver<Input extends FieldValues, Context, Output>(schema: StandardSchemaV1<Input, Output>, _schemaOptions?: never, resolverOptions?: {
    raw?: false;
}): Resolver<Input, Context, Output>;
export declare function typeschemaResolver<Input extends FieldValues, Context, Output>(schema: StandardSchemaV1<Input, Output>, _schemaOptions: never | undefined, resolverOptions: {
    raw: true;
}): Resolver<Input, Context, Input>;
