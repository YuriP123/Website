export const fileSystem = [
  {
    id: 'README',
    title: 'README.txt',
    type: 'file',
    icon: '/fileicon.png',
    sprite: 'sprite-file', // Class for sprite usage
    windowSize: { w: 400, h: 400 },
    content: `
      <div id="message">
        <p> Welcome! You have stumbled upon my little digital domain where i put all my nonsense here. </p>
        <p> Make yourself at home. It is something of a maze of technology, music, and culture. I hope you find something that you like! </p>
        <p> I hope that over time, this place will grow into something bigger. </p>
      </div>
    `,
  },
  {
    id: 'YURI',
    title: 'YuriTheDev',
    type: 'folder',
    icon: '/foldericon.png',
    sprite: 'sprite-folder',
    windowSize: { w: 600, h: 400 },
    children: [
      {
        id: 'RESUME',
        title: 'resume.txt',
        type: 'pdf',
        icon: '/fileicon.png',
        sprite: 'sprite-file',
        src: '/media/YuriPasamonteResume2026.pdf',
        windowSize: { w: 700, h: 600 },
      },
    ],
  },
  {
    id: 'MUSIC',
    title: 'MUSIC',
    type: 'folder',
    icon: '/foldericon.png',
    sprite: 'sprite-folder',
    windowSize: { w: 600, h: 400 },
    children: [
      {
        id: 'ec2a-test',
        title: 'ec2a-test.mp3',
        type: 'music',
        icon: '/soundicon.png',
        sprite: 'sprite-sound',
        src: '/media/ec2atest.mp3',
        videoSrc: '/media/ec2avideo.mp4', // Video background for this song
      },
      {
        id: 'whisper',
        title: 'whisper.mp3',
        type: 'music',
        icon: '/soundicon.png',
        sprite: 'sprite-sound',
        src: '/media/whisper.mp3',
        videoSrc: '/media/whisper.mp4', // Video background for this song
      },
    ],
  },
];

// Helper to find an item by ID recursively
export const findItemById = (items, id) => {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};
