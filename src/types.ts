/**
 * Shared type definitions
 */

/** A geographic coordinate point */
export interface Point {
  lat: number;
  lng: number;
}

/** A resolved location with name and coordinates */
export interface Location extends Point {
  name: string;
}

/** User-provided location input: name, coordinates, or both */
export interface LocationInput {
  name?: string;
  lat?: number;
  lng?: number;
}

/** Map provider interface */
export interface MapProvider {
  geocode(cityName: string): Promise<Location>;
  reverseGeocode(lat: number, lng: number): Promise<string>;
  getRoute(from: Point, to: Point, waypoints?: Point[]): Promise<Point[]>;
}

/** Bounding box for coordinate projection */
export interface Bounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/** Projected 2D point on canvas */
export interface CanvasPoint {
  x: number;
  y: number;
}

/** Route configuration */
export interface RouteConfig {
  start: LocationInput | null;
  end?: LocationInput | null;
  waypoints: LocationInput[];
}

/** Hand-drawn style configuration */
export interface StyleConfig {
  roughness: number;
  bowing: number;
  paperTexture: boolean;
}

/** Legend label configuration */
export interface LegendLabels {
  traveled?: string;
  remaining?: string;
}

/** User configuration input */
export interface UserConfig {
  width?: number;
  height?: number;
  mapProvider?: string;
  apiKey?: string;
  route?: Partial<RouteConfig>;
  currentCity?: LocationInput | null;
  style?: Partial<StyleConfig>;
  output?: string;
  showTitle?: boolean;
  showLegend?: boolean;
  legendLabels?: LegendLabels;
  /** Max API requests per second (default: 5) */
  concurrency?: number;
}

/** Merged full configuration */
export interface Config {
  width: number;
  height: number;
  mapProvider: string;
  apiKey: string;
  route: RouteConfig;
  currentCity: LocationInput | null;
  style: StyleConfig;
  output: string;
  showTitle: boolean;
  showLegend: boolean;
  legendLabels: Required<LegendLabels>;
  concurrency: number;
}

/** City marker drawing options */
export interface CityMarkerOptions {
  type: 'start' | 'end' | 'waypoint' | 'current';
  color: string;
  label: string;
}

/** Route drawing style */
export interface RouteStyle {
  stroke: string;
  strokeWidth: number;
  roughness: number;
  bowing: number;
}
