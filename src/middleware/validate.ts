import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: error.issues.map((e: any) => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
            }
            return res.status(500).json({
                success: false,
                message: "Internal server error during validation"
            });
        }
    };
