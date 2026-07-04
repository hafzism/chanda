export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  delete(key: string): Promise<void>;
  getText(key: string): Promise<string>;
  putBytes(input: {
    content: Uint8Array;
    contentHash: string;
    contentType: string;
    key: string;
  }): Promise<void>;
  putText(input: {
    content: string;
    contentHash: string;
    key: string;
  }): Promise<void>;
}
