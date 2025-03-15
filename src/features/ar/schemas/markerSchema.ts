// Path: features\ar\schemas\markerSchema.ts
import { z } from 'zod';

// Schema para a geometria de ponto (GeoJSON Point)
// Uso interno apenas, não exportado
const PointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
});

// Schema para um marcador individual (GeoJSON Feature)
// Uso interno apenas, não exportado
const MarkerSchema = z.object({
  id: z.string(),
  type: z.literal('Feature'),
  geometry: PointSchema,
  properties: z.object({
    name: z.string(),
    category: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
  }),
});

// Schema para uma coleção de marcadores (GeoJSON FeatureCollection)
export const MarkersCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(MarkerSchema),
});

// Tipos TypeScript inferidos dos schemas Zod
// Tipo Point removido já que não é usado
export type Marker = z.infer<typeof MarkerSchema>;
export type MarkersCollection = z.infer<typeof MarkersCollectionSchema>;

// Tipo estendido para marcadores com informações de distância e direção
export interface MarkerWithDistance extends Marker {
  distance: number; // Distância em metros
  bearing: number; // Direção em graus (0-360)
}
