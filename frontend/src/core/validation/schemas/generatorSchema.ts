import { z } from "zod";

export const GeneratorLoadSchema = z.object({
  id: z.string().uuid(),
  desc: z.string().min(1, "Description is required"),
  unit: z.number().min(0, "Units cannot be negative"),
  kwPerUnit: z.number().min(0, "kW cannot be negative"),
  starter: z.enum(["DOL", "Star Delta", "Soft Starter", "VFD", "None", "SD"]),
  multiplier: z.number().min(1, "Multiplier must be >= 1"),
  standby: z.number().min(0, "Standby cannot be negative"),
  excludeEmergency: z.boolean().optional().default(false),
  emergency: z.number().min(0).optional(),
  powerFail: z.number().min(0).optional(),
  remark: z.string().optional(),
});

export const GeneratorSizingSchema = z.object({
  deratingFactor1: z.number().min(0.1).max(1.0),
  deratingFactor2: z.number().min(0.1).max(1.0),
  marginFuture: z.number().min(1.0).max(2.0),
  designPowerFactor: z.number().min(0.5).max(1.0),
  alternatorReactance: z.number().min(0.01).max(1.0),
  allowableVoltageDip: z.number().min(0.01).max(0.5),
  maxStepLoadFactor: z.number().min(0.1).max(1.0),
  loads: z.array(GeneratorLoadSchema),
});

export type GeneratorLoadData = z.infer<typeof GeneratorLoadSchema>;
export type GeneratorSizingData = z.infer<typeof GeneratorSizingSchema>;
