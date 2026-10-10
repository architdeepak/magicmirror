// Original vector garments, bundled with the app. No remote asset requests.
export const wardrobeColors = { black: '#252932', white: '#e6e4dc', blue: '#346baf', red: '#a63748', green: '#3c7661', purple: '#73558e' };
export const wardrobeStyles = { 't-shirt': 'top', blouse: 'top', 'long sleeve': 'top', dress: 'dress', skirt: 'skirt' };
export function starterWardrobe() {
  return Object.entries(wardrobeStyles).flatMap(([style, category]) => Object.keys(wardrobeColors).map(color => ({
    id: `starter-${style.replaceAll(' ', '-')}-${color}`, name: `${color[0].toUpperCase() + color.slice(1)} ${style}`, category, color, style, starter: true,
    imageUrl: new URL(`./assets/wardrobe/${style.replaceAll(' ', '-')}-${color}.svg`, import.meta.url).href
  })));
}
