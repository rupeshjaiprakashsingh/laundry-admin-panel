import React from 'react';
import { Box, Typography, Breadcrumbs, Link, Button } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

interface Crumb { label: string; href?: string }
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  action?: { label: string; icon?: React.ReactNode; onClick: () => void };
  secondaryAction?: { label: string; icon?: React.ReactNode; onClick: () => void };
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumbs, action, secondaryAction }) => (
  <Box sx={{ mb: 3 }}>
    {breadcrumbs && (
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
        {breadcrumbs.map((crumb, i) =>
          crumb.href ? (
            <Link key={i} href={crumb.href} underline="hover" color="text.secondary" variant="body2">
              {crumb.label}
            </Link>
          ) : (
            <Typography key={i} variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
              {crumb.label}
            </Typography>
          )
        )}
      </Breadcrumbs>
    )}
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom={!!subtitle}>
          {title}
        </Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {secondaryAction && (
          <Button variant="outlined" startIcon={secondaryAction.icon} onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
        {action && (
          <Button variant="contained" startIcon={action.icon} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </Box>
    </Box>
  </Box>
);

export default PageHeader;
