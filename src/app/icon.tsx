import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #07111f 0%, #0b1530 55%, #132447 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 36,
            borderRadius: 96,
            border: '2px solid rgba(125, 211, 252, 0.3)',
            background: 'radial-gradient(circle at top, rgba(103, 232, 249, 0.22), transparent 58%)',
          }}
        />
        <div
          style={{
            width: 250,
            height: 250,
            borderRadius: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #34d399 0%, #4f46e5 58%, #7c3aed 100%)',
            boxShadow: '0 32px 90px rgba(11, 21, 48, 0.45)',
            fontSize: 112,
          }}
        >
          🛒
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 72,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontWeight: 700,
            fontSize: 46,
            letterSpacing: '-0.04em',
          }}
        >
          <span>Super M</span>
          <span style={{ color: '#7dd3fc' }}>AI</span>
        </div>
      </div>
    ),
    size,
  );
}
