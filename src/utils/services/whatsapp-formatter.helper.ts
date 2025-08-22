export class WhatsAppFormatter {
  constructor() {}

  splitMessage(text: string): string[] {
    text = this.cleanMessage(text);

    let blocks = text.trim().split('\n\n');
    let blocks2 = blocks.map((block) => this.splitByImages(block)); // Split each block by "\n!"
    blocks = blocks2.flat(); // Flatten the list

    blocks = blocks.map((block) => block.trim()).filter((block) => block); // Remove empty blocks

    const merged: string[] = [];
    let i = 0;
    while (i < blocks.length) {
      if (
        i > 0 &&
        (blocks[i - 1].endsWith(':') || blocks[i - 1].endsWith('?') || /^\d+\./.test(blocks[i])) &&
        !blocks[i].startsWith('!')
      ) {
        merged[merged.length - 1] += '\n\n' + blocks[i];
      } else {
        merged.push(blocks[i]);
      }
      i++;
    }

    return merged;
  }

  cleanMessage(text: string): string {
    let output = text.replace(/\【.*?\】/g, '');
    output = output.replace(/\*\*/g, '*').trim();
    return output;
  }

  splitByImages(inputText: string): string[] {
    // Define the regex pattern for markdown images
    const imagePattern = /(!\[.*?\]\(.*?\))/g;

    // Split the text by the image pattern while retaining the images in the result
    const parts = inputText.split(imagePattern);

    // Strip each part and filter out empty strings
    return parts.map((part) => part.trim()).filter((part) => part);
  }

  getMarkdownImage(text: string): { alt_text: string; url: string } | null {
    const markdownImagePattern = /!\[(.*?)\]\((.*?)\)/;
    const match = text.match(markdownImagePattern);

    if (match) {
      const altText = match[1]; // Get the alt text
      const imageUrl = match[2]; // Get the captured URL
      return { alt_text: altText, url: imageUrl }; // Return both alt text and URL
    }
    return null;
  }
}
