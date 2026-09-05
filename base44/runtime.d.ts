declare module "base44:runtime" {
  export const secrets: {
    get(name: string): string | undefined;
  };
}
