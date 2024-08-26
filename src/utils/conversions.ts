export const getOriginFromString = (origin: string): any => {
  switch (origin) {
    case "Clickcrate":
      return { clickcrate: {} };
    case "Shopify":
      return { shopify: {} };
    case "Square":
      return { square: {} };
    default:
      throw new Error(`Invalid origin: ${origin}`);
  }
};

export const getPlacementTypeFromString = (placementType: string): any => {
  switch (placementType) {
    case "Digitalreplica":
      return { digitalreplica: {} };
    case "Relatedpurchase":
      return { relatedpurchase: {} };
    case "Targetedplacement":
      return { targetedplacement: {} };
    default:
      throw new Error(`Invalid placement type: ${placementType}`);
  }
};

export const getProductCategoryFromString = (productCategory: string): any => {
  switch (productCategory) {
    case "Clothing":
      return { clothing: {} };
    case "Electronics":
      return { electronics: {} };
    case "Books":
      return { books: {} };
    case "Home":
      return { home: {} };
    case "Beauty":
      return { beauty: {} };
    case "Toys":
      return { toys: {} };
    case "Sports":
      return { sports: {} };
    case "Automotive":
      return { automotive: {} };
    case "Grocery":
      return { grocery: {} };
    case "Health":
      return { health: {} };
    default:
      throw new Error(`Invalid product category: ${productCategory}`);
  }
};
