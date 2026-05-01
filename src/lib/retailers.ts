import { Retailer } from '@/types';

export const RETAILERS: Retailer[] = [
  {
    name: 'Coles',
    baseUrl: 'https://www.coles.com.au',
    searchUrl: (q) => `https://www.coles.com.au/search?q=${encodeURIComponent(q)}`,
    color: '#E31837',
    logo: '🔴',
  },
  {
    name: 'Woolworths',
    baseUrl: 'https://www.woolworths.com.au',
    searchUrl: (q) =>
      `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(q)}`,
    color: '#00833E',
    logo: '🟢',
  },
  {
    name: 'Aldi',
    baseUrl: 'https://www.aldi.com.au',
    searchUrl: (q) => `https://www.aldi.com.au/en/search/?text=${encodeURIComponent(q)}`,
    color: '#00539F',
    logo: '🔵',
  },
  {
    name: 'IGA',
    baseUrl: 'https://www.igashop.com.au',
    searchUrl: (q) => `https://www.igashop.com.au/search?q=${encodeURIComponent(q)}`,
    color: '#E8272B',
    logo: '🟠',
  },
  {
    name: 'Costco',
    baseUrl: 'https://www.costco.com.au',
    searchUrl: (q) =>
      `https://www.costco.com.au/SearchDisplay?searchTerm=${encodeURIComponent(q)}`,
    color: '#005DAA',
    logo: '🔵',
  },
  {
    name: 'Harris Farm',
    baseUrl: 'https://www.harrisfarm.com.au',
    searchUrl: (q) =>
      `https://www.harrisfarm.com.au/search?type=product&q=${encodeURIComponent(q)}`,
    color: '#5A8A00',
    logo: '🟩',
  },
  {
    name: 'Amazon AU',
    baseUrl: 'https://www.amazon.com.au',
    searchUrl: (q) =>
      `https://www.amazon.com.au/s?k=${encodeURIComponent(q)}`,
    color: '#FF9900',
    logo: '🟡',
  },
  {
    name: 'Target',
    baseUrl: 'https://www.target.com.au',
    searchUrl: (q) =>
      `https://www.target.com.au/search?text=${encodeURIComponent(q)}`,
    color: '#D71920',
    logo: '🎯',
  },
  {
    name: 'Officeworks',
    baseUrl: 'https://www.officeworks.com.au',
    searchUrl: (q) =>
      `https://www.officeworks.com.au/shop/officeworks/search?q=${encodeURIComponent(q)}`,
    color: '#EB1C24',
    logo: '📎',
  },
  {
    name: 'Big W',
    baseUrl: 'https://www.bigw.com.au',
    searchUrl: (q) =>
      `https://www.bigw.com.au/search?text=${encodeURIComponent(q)}`,
    color: '#21409A',
    logo: '🟦',
  },
  {
    name: 'Kmart',
    baseUrl: 'https://www.kmart.com.au',
    searchUrl: (q) =>
      `https://www.kmart.com.au/search/?searchTerm=${encodeURIComponent(q)}`,
    color: '#E1251B',
    logo: '🟥',
  },
  {
    name: 'Chemist Warehouse',
    baseUrl: 'https://www.chemistwarehouse.com.au',
    searchUrl: (q) =>
      `https://www.chemistwarehouse.com.au/search?searchtext=${encodeURIComponent(q)}`,
    color: '#F5C400',
    logo: '💊',
  },
  {
    name: 'Priceline',
    baseUrl: 'https://www.priceline.com.au',
    searchUrl: (q) =>
      `https://www.priceline.com.au/search?query=${encodeURIComponent(q)}`,
    color: '#E4007C',
    logo: '🩷',
  },
];

export const RETAILER_MAP = Object.fromEntries(RETAILERS.map((r) => [r.name, r])) as Record<
  string,
  Retailer
>;
