import { SxProps, Theme } from '@mui/material/styles';

export const linkStyles = {
    footnote: {
        color: 'primary.main',
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: 'medium',
        '&:hover': {
            backgroundColor: 'action.hover',
            borderRadius: '2px',
            padding: '1px 2px'
        },
        '&:active': {
            backgroundColor: 'primary.light',
            color: 'primary.contrastText'
        }
    } as SxProps<Theme>,

    crossReference: {
        color: 'secondary.main',
        fontWeight: 'bold',
        cursor: 'pointer',
        textDecoration: 'underline',
        textDecorationColor: 'secondary.light',
        '&:hover': {
            backgroundColor: 'secondary.light',
            color: 'secondary.contrastText',
            borderRadius: '2px',
            padding: '1px 2px'
        },
        '&:active': {
            backgroundColor: 'secondary.dark',
            color: 'secondary.contrastText'
        }
    } as SxProps<Theme>,

    pageReference: {
        color: 'info.main',
        fontStyle: 'italic',
        cursor: 'pointer',
        textDecoration: 'underline',
        textDecorationStyle: 'dashed',
        '&:hover': {
            backgroundColor: 'info.light',
            color: 'info.contrastText',
            borderRadius: '2px',
            padding: '1px 2px'
        }
    } as SxProps<Theme>,

    clickableLink: {
        display: 'inline',
        position: 'relative',
        borderRadius: '2px',
        transition: 'all 0.2s ease',
        '&:focus': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '1px'
        }
    } as SxProps<Theme>
};

// CSS classes for use with dangerouslySetInnerHTML
export const linkCssClasses = `
.clickable-link {
    cursor: pointer;
    border-radius: 2px;
    transition: all 0.2s ease;
    padding: 1px 2px;
    margin: -1px -2px;
}

.clickable-link:hover {
    background-color: rgba(0, 0, 0, 0.04);
}

.clickable-link.footnote {
    color: #1976d2;
    text-decoration: underline;
    text-decoration-style: dotted;
    font-size: 0.9em;
    font-weight: 500;
}

.clickable-link.cross-reference {
    color: #9c27b0;
    font-weight: bold;
    text-decoration: underline;
}

.clickable-link.page-reference {
    color: #0288d1;
    font-style: italic;
    text-decoration: underline;
    text-decoration-style: dashed;
}

/* Dark mode styles */
@media (prefers-color-scheme: dark) {
    .clickable-link:hover {
        background-color: rgba(255, 255, 255, 0.08);
    }
    
    .clickable-link.footnote {
        color: #90caf9;
    }
    
    .clickable-link.cross-reference {
        color: #ce93d8;
    }
    
    .clickable-link.page-reference {
        color: #81d4fa;
    }
}
`; 