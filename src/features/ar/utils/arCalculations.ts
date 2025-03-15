// Path: features\ar\utils\arCalculations.ts

/**
 * Calculates the horizontal position of a marker on screen
 *
 * @param bearing Direction to the marker in degrees
 * @param heading Current device heading in degrees
 * @param fieldOfView Camera field of view in degrees
 * @param safeMargin Safety margin to avoid markers at edges
 * @returns Normalized position (0-1, where 0 is left edge, 1 is right edge)
 */
export const calculateMarkerPosition = (
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
  safeMargin: number = 0.1,
): number => {
  // Calculate relative bearing
  let relativeBearing = bearing - heading;

  // Normalize to -180 to 180 degrees
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

  // Convert to screen position (0-1)
  const position = 0.5 + relativeBearing / fieldOfView;

  // Apply safety margin
  const safeMin = safeMargin;
  const safeMax = 1 - safeMargin;

  // Clamp to safe zone
  return Math.max(safeMin, Math.min(safeMax, position));
};

/**
 * Calculates marker visual size based on distance
 *
 * @param distance Distance to marker in meters
 * @param baseSize Base size in pixels
 * @param minSize Minimum size in pixels
 * @returns Size in pixels
 */
export const calculateMarkerSize = (
  distance: number,
  baseSize: number = 60,
  minSize: number = 30,
): number => {
  // Logarithmic scale for more natural size reduction with distance
  const factor = 1 - Math.min(0.8, Math.log10(distance / 10) / 3);
  const size = baseSize * Math.max(0.2, factor);

  return Math.max(minSize, size);
};

/**
 * Calculates marker opacity based on distance
 *
 * @param distance Distance to marker in meters
 * @param maxDistance Maximum visibility distance
 * @param minOpacity Minimum opacity
 * @returns Opacity value (0-1)
 */
export const calculateMarkerOpacity = (
  distance: number,
  maxDistance: number = 500,
  minOpacity: number = 0.4,
): number => {
  return Math.max(minOpacity, Math.min(1, 1 - distance / maxDistance));
};

/**
 * Calculates marker priority based on distance and angle
 * Higher priority markers are shown when filtering
 *
 * @param distance Distance to marker in meters
 * @param relativeBearing Angle to marker relative to view center
 * @param fieldOfView Camera field of view
 * @returns Priority value (higher = more important)
 */
export const calculateMarkerPriority = (
  distance: number,
  relativeBearing: number,
  fieldOfView: number = 60,
): number => {
  // Angle priority (1 at center, 0 at edges)
  const normalizedAngle = relativeBearing / (fieldOfView / 2);
  const anglePriority = 1 - Math.min(1, Math.abs(normalizedAngle));

  // Distance priority (1 when close, 0 when far)
  const distancePriority = Math.max(0, 1 - distance / 500);

  // Combined priority (70% distance, 30% angle)
  return distancePriority * 0.7 + anglePriority * 0.3;
};

/**
 * Determines if a marker is within the current field of view
 *
 * @param bearing Direction to marker in degrees
 * @param heading Current device heading in degrees
 * @param fieldOfView Camera field of view in degrees
 * @param margin Extra margin to add to field of view
 * @returns True if marker is visible
 */
export const isMarkerInView = (
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
  margin: number = 5,
): boolean => {
  // Calculate relative bearing
  let relativeBearing = bearing - heading;

  // Normalize to -180 to 180 degrees
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

  // Add margin to field of view
  const extendedFOV = fieldOfView + margin * 2;

  // Check if within extended field of view
  return Math.abs(relativeBearing) < extendedFOV / 2;
};
