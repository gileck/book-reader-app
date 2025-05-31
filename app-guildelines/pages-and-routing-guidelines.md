# SPA Routing Guidelines

This document outlines the process for adding new routes to our Single Page Application (SPA) routing system.

## Overview

Our application uses a custom SPA routing system built on top of Next.js. The routing system is implemented in the `src/client/router` directory and consists of:

1. A `RouterProvider` component that manages navigation and renders the current route
2. Route components organized in folders within the `src/client/routes` directory
3. Route configuration in the `src/client/routes/index.ts` file
4. Navigation components in the `src/client/components/layout` directory

## Adding a New Route

Follow these steps to add a new route to the application:

### 1. Create a Route Component Folder

Create a new folder in the `src/client/routes` directory with the name of your route component:

```
src/client/routes/
├── NewRoute/
│   ├── NewRoute.tsx
│   └── index.ts
```

#### Create the route component file:

```tsx
// src/client/routes/NewRoute/NewRoute.tsx
import { Box, Typography } from '@mui/material';
import { useRouter } from '../../router';

export const NewRoute = () => {
  const { routeParams, queryParams } = useRouter();
  
  return (
    <Box>
      <Typography variant="h4">New Route</Typography>
      <Typography paragraph>This is a new route in our application.</Typography>
    </Box>
  );
};
```

#### Create the index.ts file to export the component:

```tsx
// src/client/routes/NewRoute/index.ts
export { NewRoute } from './NewRoute';
```

### Component Organization Guidelines

Follow these best practices for route components:

- **Keep route components focused and small**: The main route component should be primarily responsible for layout and composition, not complex logic.
  
- **Split large components**: If a route component is getting too large (over 200-300 lines), split it into multiple smaller components within the same route folder.
  
- **Route-specific components**: Components that are only used by a specific route should be placed in that route's folder.
  
- **Shared components**: If a component is used by multiple routes, move it to `src/client/components` directory.
  
- **Component hierarchy**:
  ```
  src/client/routes/NewRoute/           # Route-specific folder
  ├── NewRoute.tsx                      # Main route component (exported)
  ├── NewRouteHeader.tsx                # Route-specific component
  ├── NewRouteContent.tsx               # Route-specific component
  ├── NewRouteFooter.tsx                # Route-specific component
  └── index.ts                          # Exports the main component
  
  src/client/components/                # Shared components
  ├── SharedComponent.tsx               # Used by multiple routes
  └── ...
  ```

- Extract business logic into separate hooks or utility functions
- Follow the naming convention of PascalCase for component files and folders
- Use named exports (avoid default exports as per our guidelines)
- Keep related components and utilities in the same folder

### 2. Register the Route in the Routes Configuration

Add your new route to the routes configuration in `src/client/routes/index.ts`:

```tsx
// Import your new route component
import { NewRoute } from './NewRoute';

// Add it to the routes configuration
export const routes = createRoutes({
  '/': Home,
  '/ai-chat': AIChat,
  '/settings': Settings,
  '/file-manager': FileManager,
  '/new-route': NewRoute, // Add your new route here
  '/not-found': NotFound,
});
```

Route path naming conventions:
- Use kebab-case for route paths (e.g., `/new-route`, not `/newRoute`)
- Keep paths descriptive but concise
- Avoid deep nesting when possible

### 3. Add Navigation Item

Update the navigation items in `src/client/components/NavLinks.tsx` to include your new route:

```tsx
import NewRouteIcon from '@mui/icons-material/Extension'; // Choose an appropriate icon

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <HomeIcon /> },
  { path: '/ai-chat', label: 'AI Chat', icon: <ChatIcon /> },
  { path: '/file-manager', label: 'Files', icon: <FolderIcon /> },
  { path: '/new-route', label: 'New Route', icon: <NewRouteIcon /> }, // Add your new route here
  { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];
```

Navigation item guidelines:
- Choose a descriptive but concise label
- Select an appropriate Material UI icon that represents the route's purpose
- Consider the order of items in the navigation (most important/frequently used routes should be more accessible)

## Using the Router

### Navigation

To navigate between routes in your components, use the `useRouter` hook:

```tsx
import { useRouter } from '../../router';

const MyComponent = () => {
  const { navigate } = useRouter();
  
  const handleClick = () => {
    navigate('/new-route');
  };
  
  // You can also replace the current history entry
  const handleReplace = () => {
    navigate('/new-route', { replace: true });
  };
  
  return (
    <Button onClick={handleClick}>Go to New Route</Button>
  );
};
```

### Navigation Guidelines

- **Always use the navigation API from useRouter**: Never use `window.location.href` for navigation as it causes a full page reload and breaks the SPA behavior.

```tsx
// ❌ Don't do this
window.location.href = '/some-route';

// ✅ Do this instead
const { navigate } = useRouter();
navigate('/some-route');
```

- This ensures consistent navigation behavior throughout the application
- Preserves the SPA (Single Page Application) experience
- Maintains application state during navigation
- Enables proper history management

### Navigating with Parameters

When navigating to routes that require parameters (like IDs), construct the path with the parameters included:

```tsx
// Navigating to a route with a parameter
const { navigate } = useRouter();

// Navigate to a video page with a specific video ID
const handleVideoClick = (videoId) => {
  navigate(`/video/${videoId}`);
};

// Navigate to a channel page with a specific channel ID
const handleChannelClick = (channelId) => {
  navigate(`/channel/${channelId}`);
};
```

For routes with multiple parameters, include all parameters in the path:

```tsx
// Route with multiple parameters
navigate(`/category/${categoryId}/product/${productId}`);
```

You can also include query parameters:

```tsx
// Navigate with query parameters
navigate(`/search?q=${encodeURIComponent(searchQuery)}&filter=${filter}`);

// Note: When using query parameters, always use `encodeURIComponent()` for any user-provided values to ensure proper URL encoding.
```

### Getting Current Route

You can access the current route path using the `useRouter` hook:

```tsx
import { useRouter } from '../../router';

const MyComponent = () => {
  const { currentPath } = useRouter();
  
  return (
    <div>
      <p>Current path: {currentPath}</p>
    </div>
  );
};
```

## Advanced Routing Features

### Route Parameters

Our router automatically parses route parameters from the URL path. To define a route with parameters, use the colon syntax in your route path:

```tsx
// In src/client/routes/index.ts
export const routes = createRoutes({
  // Other routes...
  '/items/:id': ItemDetail,
});
```

Then access the parameters in your component using the `useRouter` hook:

```tsx
// src/client/routes/ItemDetail/ItemDetail.tsx
import { useRouter } from '../../router';

export const ItemDetail = () => {
  const { routeParams } = useRouter();
  const itemId = routeParams.id;
  
  return (
    <div>
      <h1>Item Detail</h1>
      {itemId ? <p>Item ID: {itemId}</p> : <p>Invalid item ID</p>}
    </div>
  );
};
```

### Query Parameters

The router also automatically parses query parameters from the URL. Access them in your component using the `useRouter` hook:

```tsx
// src/client/routes/SearchResults/SearchResults.tsx
import { useRouter } from '../../router';

export const SearchResults = () => {
  const { queryParams } = useRouter();
  const searchQuery = queryParams.q || '';
  
  return (
    <div>
      <h1>Search Results</h1>
      <p>Query: {searchQuery}</p>
    </div>
  );
};
