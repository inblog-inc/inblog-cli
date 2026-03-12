import { Command } from 'commander';
import { isJsonMode } from '../utils/client-factory.js';
import { printJson, printSuccess } from '../utils/output.js';
import { handleError } from '../utils/errors.js';
import { uploadImage, type ImageBucket } from '../utils/upload.js';

const VALID_BUCKETS: ImageBucket[] = ['post_image', 'featured_image', 'logo', 'favicon', 'og_image', 'banner', 'avatar'];

export function registerImagesCommands(program: Command): void {
  const images = program.command('images').description('Upload images to inblog CDN');

  images
    .command('upload <file...>')
    .description('Upload local image file(s) to inblog CDN')
    .option('-b, --bucket <type>', 'Image bucket (post_image, featured_image, logo, favicon, og_image, banner)', 'post_image')
    .action(async function (this: Command, files: string[]) {
      const json = isJsonMode(this);
      try {
        const opts = this.opts();
        const bucket = opts.bucket as ImageBucket;
        if (!VALID_BUCKETS.includes(bucket)) {
          throw new Error(`Invalid bucket: ${bucket}. Valid: ${VALID_BUCKETS.join(', ')}`);
        }

        const results: { file: string; url: string }[] = [];
        for (const file of files) {
          const url = await uploadImage(file, bucket);
          results.push({ file, url });
          if (!json) {
            printSuccess(`${file} → ${url}`);
          }
        }

        if (json) {
          printJson(results);
        }
      } catch (error) {
        handleError(error, json);
      }
    });
}
