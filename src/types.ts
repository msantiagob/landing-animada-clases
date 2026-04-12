export interface Link {
  title: string;
  url: string;
  target?: string;
}

export interface NavLink {
  title: string;
  url?: string;
  groups?: {
    label: string;
    items: {
      title: string;
      url: string;
      desc?: string;
      icon?: string;
    }[];
  }[];
}

export interface Image {
  width?: string | number;
  height?: string | number;
  src: string;
  alt: string;
}
