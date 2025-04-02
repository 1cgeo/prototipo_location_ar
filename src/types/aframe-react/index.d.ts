// Path: types\aframe-react\index.d.ts
declare module 'aframe-react' {
  import * as React from 'react';

  export interface EntityProps {
    [key: string]: any;
    primitive?: string;
    material?: any;
    position?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    animation__click?: any;
    animation__clickend?: any;
    'gps-entity-place'?: string;
    'gps-entity-click-handler'?: any;
    'gps-camera'?: any;
    'look-at'?: string;
    'data-marker-id'?: string;
    'data-marker-name'?: string;
    'data-marker-category'?: string;
  }

  export interface SceneProps {
    [key: string]: any;
    embedded?: boolean;
    arjs?: any;
    'vr-mode-ui'?: { enabled: boolean };
    renderer?: any;
    style?: React.CSSProperties;
  }

  export class Entity extends React.Component<EntityProps> {}
  export class Scene extends React.Component<SceneProps> {}
}
