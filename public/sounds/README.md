# Admin Call System Sound Files

This directory contains audio files for the admin call system alerts.

## Required Sound Files

Place the following MP3 files in this directory:

- `default.mp3` - Gentle notification sound (default)
- `chime.mp3` - Pleasant chime sound
- `bell.mp3` - Bell notification sound
- `siren.mp3` - Urgent siren sound (for critical alerts)

## Getting Sound Files

You can find free notification sounds from:
- [Freesound.org](https://freesound.org/) - Free sound effects
- [Zapsplat](https://www.zapsplat.com/) - Free sound library
- [Mixkit](https://mixkit.co/free-sound-effects/) - Free sound effects

## Sound Requirements

- **Format**: MP3
- **Duration**: 1-3 seconds (short notifications)
- **Quality**: 128kbps or higher
- **Volume**: Normalized to avoid sudden loud sounds

## Testing

The admin call system will automatically use these sound files when:
1. A new admin call is received
2. The admin is active and has sound enabled
3. The user has interacted with the page (browser requirement)

## File Structure

```
public/sounds/
├── default.mp3    # Default notification sound
├── chime.mp3      # Pleasant chime sound
├── bell.mp3       # Bell notification sound
├── siren.mp3      # Urgent siren sound
└── README.md      # This file
```

## Browser Compatibility

Modern browsers require user interaction before playing audio. The system handles this gracefully by:
- Attempting to play sounds when calls arrive
- Showing visual indicators if audio fails
- Providing manual test buttons in the preferences panel 