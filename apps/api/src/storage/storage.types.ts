export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  delete(key: string): Promise<void>;
  getText(key: string): Promise<string>;
  putText(input: {
    content: string;
    contentHash: string;
    key: string;
  }): Promise<void>;
}
