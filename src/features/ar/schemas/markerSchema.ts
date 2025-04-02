// Path: features\ar\schemas\markerSchema.ts
export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// Schema for marker properties
export interface MarkerProperties {
  name: string;
  category: string;
  description?: string;
  icon?: string;
}

// Schema for an individual marker (GeoJSON Feature)
export interface Marker {
  id: string;
  type: 'Feature';
  geometry: PointGeometry;
  properties: MarkerProperties;
}

// Schema for a collection of markers (GeoJSON FeatureCollection)
export interface MarkersCollection {
  type: 'FeatureCollection';
  features: Marker[];
}

// Extended type with distance and bearing information
export interface MarkerWithDistance extends Marker {
  distance: number; // Distance in meters
  bearing: number; // Direction in degrees (0-360)
}
