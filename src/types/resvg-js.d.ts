declare module "@resvg/resvg-js" {
  export class Resvg {
    constructor(svg: string, options?: { fitTo?: { mode: string; value: number } });
    render(): { asPng(): Uint8Array };
  }
}
