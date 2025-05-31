import { Drawer, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useRouter } from '../../router';
import { NavItem } from '../../components/layout/types';

interface DrawerMenuProps {
  navItems: NavItem[];
  mobileOpen: boolean;
  onDrawerToggle: () => void;
}

export const DrawerMenu = ({ navItems, mobileOpen, onDrawerToggle }: DrawerMenuProps) => {
  const { currentPath, navigate } = useRouter();

  const handleNavigation = (path: string) => {
    navigate(path);
    onDrawerToggle();
  };

  const drawerContent = (
    <Box onClick={onDrawerToggle} sx={{ textAlign: 'center' }}>
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              sx={{ textAlign: 'center' }}
              onClick={() => handleNavigation(item.path)}
              selected={currentPath === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={onDrawerToggle}
      ModalProps={{
        keepMounted: true, // Better open performance on mobile
      }}
      sx={{
        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default DrawerMenu;
