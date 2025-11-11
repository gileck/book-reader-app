/**
 * Centralized CSS modules export for UploadBook route
 * 
 * Import pattern in components:
 * import styles from './styles'
 * 
 * Usage:
 * <div className={styles.container}>
 * <div className={styles.uploadCard}>
 */

import uploadBookStyles from './UploadBook.module.css';
import uploadCardStyles from './UploadCard.module.css';
import uploadStatusStyles from './UploadStatus.module.css';
import uploadProgressStyles from './UploadProgress.module.css';
import uploadErrorStyles from './UploadError.module.css';
import uploadActionsStyles from './UploadActions.module.css';
import uploadFormStyles from './UploadForm.module.css';
import stopDialogStyles from './StopDialog.module.css';
import validationDialogStyles from './ValidationDialog.module.css';
import previewDialogStyles from './PreviewDialog.module.css';
import emptyStateStyles from './EmptyState.module.css';

// Combine all styles into a single object
const styles = {
    ...uploadBookStyles,
    ...uploadCardStyles,
    ...uploadStatusStyles,
    ...uploadProgressStyles,
    ...uploadErrorStyles,
    ...uploadActionsStyles,
    ...uploadFormStyles,
    ...stopDialogStyles,
    ...validationDialogStyles,
    ...previewDialogStyles,
    ...emptyStateStyles,
};

export default styles;

