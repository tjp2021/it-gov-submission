# Real Label Image Sources for Testing

Use these sources to download real bottle label photos, then degrade them for testing.

## Workflow
```bash
# 1. Download from URL
node scripts/download-label.js "<url>" brand-name

# 2. Create degraded versions
node scripts/degrade-labels.js src/test-data/sample-labels/real/brand-name.jpg
```

---

## Free Stock Photo Sites (No Account Required)

### Pixabay (Best for Free)
- [Jack Daniels](https://pixabay.com/images/search/jack%20daniels/)
- [Whiskey bottles](https://pixabay.com/images/search/whiskey%20bottle/)
- [Wine bottles](https://pixabay.com/images/search/wine%20bottle/)
- [Beer bottles](https://pixabay.com/images/search/beer%20bottle/)
- [Vodka](https://pixabay.com/images/search/vodka/)
- [Gin](https://pixabay.com/images/search/gin%20bottle/)
- [Tequila](https://pixabay.com/images/search/tequila/)
- [Heineken](https://pixabay.com/images/search/heineken/)

### Unsplash (Free, High Quality)
- [Wine labels](https://unsplash.com/s/photos/wine-label)
- [Beer bottles](https://unsplash.com/s/photos/beer-bottle)
- [Whiskey](https://unsplash.com/s/photos/whiskey-bottle)
- [Heineken](https://unsplash.com/s/photos/heineken)
- [Liquor bottles](https://unsplash.com/s/photos/liquor-bottle)

### Pexels (Free)
- [Tanqueray Gin](https://www.pexels.com/photo/tanqueray-gin-in-glass-bottle-9765434/)
- [Wine bottles](https://www.pexels.com/search/wine%20bottle/)
- [Beer](https://www.pexels.com/search/beer%20bottle/)
- [Spirits](https://www.pexels.com/search/liquor%20bottle/)

---

## Brands by Category

### Whiskey (Top 3)
| Brand | Free Source |
|-------|-------------|
| Jack Daniel's | [Pixabay](https://pixabay.com/images/search/jack%20daniels/) |
| Maker's Mark | [Whiskey ID](https://whiskeyid.com/tag/makers-mark/) (reference photos) |
| Jim Beam | [iStock Preview](https://www.istockphoto.com/photos/jim-beam-whiskey) |

### Beer (Top 3)
| Brand | Free Source |
|-------|-------------|
| Budweiser | [Dreamstime Preview](https://www.dreamstime.com/photos-images/budweiser-bottle.html) |
| Corona | [BeerMenus](https://www.beermenus.com/beers/512-corona/label) |
| Heineken | [Pixabay](https://pixabay.com/images/search/heineken/), [Unsplash](https://unsplash.com/s/photos/heineken) |

### Wine (Top 3)
| Brand | Free Source |
|-------|-------------|
| Yellow Tail | [PurePNG](https://purepng.com/photo/9689/objects-yellow-tail-wine-bottle) |
| Barefoot | [Shutterstock Preview](https://www.shutterstock.com/search/barefoot-wine-bottle) |
| Robert Mondavi | [Unsplash wine labels](https://unsplash.com/s/photos/wine-label) |

### Gin (Top 3)
| Brand | Free Source |
|-------|-------------|
| Tanqueray | [Pexels](https://www.pexels.com/photo/tanqueray-gin-in-glass-bottle-9765434/) |
| Bombay Sapphire | [Getty Preview](https://www.gettyimages.com/photos/bombay-sapphire-gin) |
| Hendrick's | [Pixabay gin](https://pixabay.com/images/search/gin%20bottle/) |

### Tequila (Top 3)
| Brand | Free Source |
|-------|-------------|
| Jose Cuervo | [iStock Preview](https://www.istockphoto.com/photos/jose-cuervo-tequila) |
| Patrón | [Getty Preview](https://www.gettyimages.com/photos/patron-tequila-bottle) |
| Don Julio | [Pixabay tequila](https://pixabay.com/images/search/tequila/) |

### Vodka (Top 3)
| Brand | Free Source |
|-------|-------------|
| Smirnoff | [Pixabay vodka](https://pixabay.com/images/search/vodka/) |
| Absolut | [Adobe Stock Preview](https://stock.adobe.com/search?k=absolut+vodka) |
| Grey Goose | [PNGPlay](https://www.pngplay.com/image/568348) |

### Brandy/Cognac (Top 3)
| Brand | Free Source |
|-------|-------------|
| Hennessy | [Vecteezy](https://www.vecteezy.com/free-photos/hennessy-bottle) |
| Rémy Martin | [Pixabay cognac](https://pixabay.com/images/search/cognac/) |
| Courvoisier | [Dreamstime Preview](https://www.dreamstime.com/photos-images/courvoisier.html) |

---

## Tips for Finding Good Test Images

1. **Search Google Images** for "[brand] bottle label photo"
2. **Look for close-ups** that show the label clearly
3. **Avoid promotional shots** - real photos are better for testing
4. **Check Wikipedia** - often has good product photos under Creative Commons
5. **Use "filetype:jpg"** in Google search for direct image links

---

## Application Data for Testing

When testing with real labels, you'll need to enter the actual label information:

### Example: Jack Daniel's Old No. 7
```
Brand Name: Jack Daniel's
Class/Type: Tennessee Whiskey
Alcohol Content: 40% Alc./Vol. (80 Proof)
Net Contents: 750 mL
Name/Address: Jack Daniel Distillery, Lynchburg, Tennessee
Country of Origin: USA
```

### Example: Corona Extra
```
Brand Name: Corona Extra
Class/Type: Imported Beer
Alcohol Content: 4.6% Alc./Vol.
Net Contents: 12 FL. OZ. (355 mL)
Name/Address: Cervecería Modelo, Mexico City, Mexico
Country of Origin: Mexico
```

### Example: Yellow Tail Shiraz
```
Brand Name: [yellow tail]
Class/Type: Shiraz
Alcohol Content: 13.5% Alc./Vol.
Net Contents: 750 mL
Name/Address: Casella Family Brands, Yenda, NSW, Australia
Country of Origin: Australia
```
