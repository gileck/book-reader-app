import { Typography, Paper, Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useRouter } from '../../router';

export const NotFound = () => {
  const { navigate } = useRouter();
  
  return (
    <Paper elevation={0} sx={{ width: '100%', textAlign: 'center' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        404 - Page Not Found
      </Typography>
      <Typography variant="body1" paragraph>
        The page you are looking for doesn&apos;t exist or has been moved.
      </Typography>
      
      <Button 
        variant="contained" 
        startIcon={<HomeIcon />}
        onClick={() => navigate('/')}
        sx={{ mt: 2 }}
      >
        Back to Home
      </Button>
    </Paper>
  );
};

export default NotFound;
