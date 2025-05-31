import { Box, Container } from '@mui/material';

interface FooterProps {
  isStandalone?: boolean;
}

export const Footer = ({ isStandalone }: FooterProps) => {
  return (
    <Box component="footer" sx={{
      py: 3,
      px: 2,
      mt: 'auto',
      backgroundColor: (theme) => theme.palette.grey[200],
      // Ensure footer is above the home indicator on iOS
      ...(isStandalone && {
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)'
      }),
      // Hide footer on mobile devices since we have bottom navigation
      display: { xs: 'none', sm: 'block' }
    }}>
      <Container maxWidth="sm">

      </Container>
    </Box>
  );
};

export default Footer;
