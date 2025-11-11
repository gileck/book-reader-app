# UploadBook CSS Modules Structure

This directory contains the modularized CSS files for the UploadBook route, split from a single 3000+ line file into smaller, organized modules.

## File Organization

### Core Layout
- **UploadBook.module.css** - Main container, header, and uploads list layout

### Upload Components
- **UploadCard.module.css** - Upload card container, header, metadata, and body styles
- **UploadStatus.module.css** - Status badges, expiration timers, and expired state
- **UploadProgress.module.css** - Progress bars, parsing messages, and loading spinners
- **UploadError.module.css** - Error messages and error sections

### Form & Actions
- **UploadForm.module.css** - Upload form, mode toggle, file input, and URL input
- **UploadActions.module.css** - All action buttons (approve, delete, stop, view, add, retry, etc.)

### Dialogs
- **StopDialog.module.css** - Stop confirmation dialog
- **ValidationDialog.module.css** - Validation error dialog with error list
- **PreviewDialog.module.css** - Book preview dialog with metadata, chapters, images, and debug info

### Misc
- **EmptyState.module.css** - Empty state component

## Usage

All styles are re-exported through `index.ts` for convenience:

```tsx
import styles from '../styles';

// Use any class from any module
<div className={styles.container}>
  <div className={styles.uploadCard}>
    <button className={styles.approveButton}>
```

## Benefits of This Structure

1. **Maintainability** - Each file focuses on a specific component or feature
2. **Readability** - Easier to find and update specific styles
3. **Performance** - Better tree-shaking potential (though CSS modules don't tree-shake by default)
4. **Organization** - Logical grouping makes it clear where styles belong
5. **Collaboration** - Multiple developers can work on different style files without conflicts

## Migration Notes

- Moved from `UploadBook.module.css` (3046 lines) → 11 organized files (150-500 lines each)
- All component imports updated to use `import styles from '../styles'`
- Merged separate `UploadCard.module.css` validation error styles into the new structure
- Zero TypeScript or ESLint errors after migration

