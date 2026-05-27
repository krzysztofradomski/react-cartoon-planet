declare module 'earcut' {
  function earcut(data: number[], holeIndices?: number[], dim?: number): number[];
  export default earcut;
}

declare module '*.geojson?url' {
  const url: string;
  export default url;
}

declare module '*.css' {}
