import { createLocalizedPathnamesNavigation } from 'next-intl/navigation';
import { locales } from './request';

export const { Link, redirect, usePathname, useRouter } =
  createLocalizedPathnamesNavigation({
    locales,
    pathnames: {
      '/':                    '/',
      '/patients':            '/patients',
      '/patients/[id]':       '/patients/[id]',
      '/appointments':        '/appointments',
      '/emr/[encounterId]':   '/emr/[encounterId]',
      '/queue':               '/queue',
      '/pharmacy':            '/pharmacy',
      '/laboratory':          '/laboratory',
      '/billing':             '/billing',
      '/settings':            '/settings',
    },
  });
