import ConverterWorker from '../../../workers/converter.worker?worker&inline';

export interface ConvertedDoc {
  markdown: string;
  html: string;
  warnings: string[];
  filename: string;
  format: string;
  pages?: number;
}

export class DocConverter {
  private worker: Worker | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new ConverterWorker();
    }
    return this.worker;
  }

  async convert(file: File): Promise<ConvertedDoc> {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
    const format = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'md' ? 'md' : 'txt';

    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const handler = (e: MessageEvent): void => {
        worker.removeEventListener('message', handler);
        if (e.data.type === 'result') {
          resolve({
            markdown: e.data.markdown as string,
            html: e.data.html as string,
            warnings: e.data.warnings as string[],
            filename: file.name,
            format,
            pages: e.data.pages as number | undefined,
          });
        } else {
          reject(new Error(e.data.error as string));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'convert', arrayBuffer, filename: file.name, format });
    });
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
