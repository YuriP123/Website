'use client';

export default function FolderContent({ items, onOpen }) {
  if (!items) return null;

  return (
    <div className="yuri-music" style={{ border: 'none', background: 'transparent' }}>
      {items.map((item) => (
        <div
          className="icon music-icon"
          key={item.id}
          onClick={() => onOpen(item.id, item.type)}
          style={{ cursor: 'pointer' }}
        >
          <div
            className={`sprite-top ${item.sprite}`}
            style={{
              backgroundImage: `url(${item.icon})`,
              backgroundPosition: '0 0',
              backgroundSize: '28px 72px', // Default, might need adjustment per sprite
            }}
          />
          <h5>{item.title}</h5>
        </div>
      ))}
    </div>
  );
}
