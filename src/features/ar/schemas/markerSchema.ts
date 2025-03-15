// Path: features\ar\schemas\markerSchema.ts
import { z } from 'zod';

// Schema for GeoJSON point geometry
const PointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
});

// Schema for marker properties
const MarkerPropertiesSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
});

// Schema for an individual marker (GeoJSON Feature)
const MarkerSchema = z.object({
  id: z.string(),
  type: z.literal('Feature'),
  geometry: PointSchema,
  properties: MarkerPropertiesSchema,
});

// Schema for a collection of markers (GeoJSON FeatureCollection)
export const MarkersCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(MarkerSchema),
});

// TypeScript types derived from Zod schemas
export type Marker = z.infer<typeof MarkerSchema>;
export type MarkersCollection = z.infer<typeof MarkersCollectionSchema>;

// Extended type with distance and bearing information
export interface MarkerWithDistance extends Marker {
  distance: number; // Distance in meters
  bearing: number; // Direction in degrees (0-360)
}
