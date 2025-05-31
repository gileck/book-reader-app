import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { useRouter } from '../../router';
import { NavItem } from '../../components/layout/types';

interface BottomNavBarProps {
  navItems: NavItem[];
  isStandalone?: boolean;
}

export const BottomNavBar = ({ navItems, isStandalone }: BottomNavBarProps) => {
  const { currentPath, navigate } = useRouter();
  
  // Get the current navigation value based on the path
  const getCurrentNavValue = () => {
    const index = navItems.findIndex(item => item.path === currentPath);
    return index >= 0 ? index : 0;
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        display: { xs: 'block', sm: 'none' },
        zIndex: 1100,
        borderRadius: 0,
        ...(isStandalone && {
          paddingBottom: 'env(safe-area-inset-bottom)'
        })
      }} 
      elevation={3}
    >
      <BottomNavigation
        showLabels
        value={getCurrentNavValue()}
        onChange={(_, newValue) => {
          const selectedPath = navItems[newValue]?.path || '/';
          handleNavigation(selectedPath);
        }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction 
            key={item.path}
            label={item.label} 
            icon={item.icon} 
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNavBar;
