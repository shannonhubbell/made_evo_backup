import z from "zod";
import { GraphDataSchema } from "./index";

export const CountDataPointSchema = z.object({
    category: z.string().min(1, 'Category is required'),
    data: z.record(z.string(), z.number())
});

export const CountDataSchema = z.object({
    data: z.array(CountDataPointSchema).min(1, 'At least one data point is required')
});

export const ReportItemSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    data: GraphDataSchema,
    type: z.enum(['bar', 'trend']).optional().default('bar'),
});

export const ReportAreaSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    countType: z.enum(['Count', 'Percent']).optional(),
    id: z.string().min(1, 'ID is required'),
    items: z.array(ReportItemSchema),
    inverted: z.boolean().optional()
});

export const ReportCategorySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    id: z.string().min(1, 'ID is required'),
    items: z.array(ReportAreaSchema),
});

export const ReportSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    title: z.string().min(1, 'Title is required'),
    date: z.string().min(1, 'Date is required'),
    period: z.enum(['Year', 'Quarter', 'Decade']),
    goal: z.string().min(1, 'Goal is required'),
    description: z.string().optional(),
    categories: z.array(ReportCategorySchema),
});

export const ReportPropsSchema = z.object({
    report: ReportSchema,
});

export type CountDataPoint = z.infer<typeof CountDataPointSchema>;
export type CountData = z.infer<typeof CountDataSchema>;
export type ReportCategory = z.infer<typeof ReportCategorySchema>;
export type Report = z.infer<typeof ReportSchema>;

export type ReportItem = z.infer<typeof ReportItemSchema>;
export type ReportArea = z.infer<typeof ReportAreaSchema>;
export type ReportProps = z.infer<typeof ReportPropsSchema>;