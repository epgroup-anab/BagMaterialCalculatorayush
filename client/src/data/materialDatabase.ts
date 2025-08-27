export interface MaterialItem {
  sapCode: string;
  description: string;
}

export interface MaterialDatabase {
  PAPER: {
    VIRGIN: Record<string, MaterialItem>;
    RECYCLED: Record<string, MaterialItem>;
    FIBREFORM: Record<string, MaterialItem>;
  };
  GLUE: {
    COLD: MaterialItem;
    HOT: MaterialItem;
  };
  HANDLE: {
    FLAT: MaterialItem;
    TWISTED: MaterialItem;
  };
  PATCH: {
    FLAT: MaterialItem;
    TWISTED: MaterialItem;
  };
  CARTON: Record<string, MaterialItem>;
}

export const MATERIAL_DATABASE: MaterialDatabase = {
  PAPER: {
    VIRGIN: {
      "50": { sapCode: "1004016", description: "Virgin Kraft 50 GSM" },
      "70": { sapCode: "1004359", description: "Virgin Kraft 70 GSM" },
      "75": { sapCode: "1003988", description: "Virgin Kraft 75 GSM" },
      "80": { sapCode: "1003696", description: "Virgin Kraft 80 GSM" },
      "85": { sapCode: "1003771", description: "Virgin Kraft 85 GSM" },
      "90": { sapCode: "1003696", description: "Virgin Kraft 90 GSM" },
      "100": { sapCode: "1004286", description: "Virgin Kraft 100 GSM" },
      "120": { sapCode: "1004369", description: "Virgin Kraft 120 GSM" },
      "150": { sapCode: "1003833", description: "Virgin Kraft 150 GSM" }
    },
    RECYCLED: {
      "50": { sapCode: "1004016", description: "Recycled Kraft 50 GSM" },
      "70": { sapCode: "1004359", description: "Recycled Kraft 70 GSM" },
      "80": { sapCode: "1003696", description: "Recycled Kraft 80 GSM" },
      "85": { sapCode: "1003696", description: "Recycled Kraft 85 GSM" },
      "90": { sapCode: "1003696", description: "Recycled Kraft 90 GSM" },
      "100": { sapCode: "1004017", description: "Recycled Kraft 100 GSM" }
    },
    FIBREFORM: {
      "150": { sapCode: "1003998", description: "Fibreform 150 GSM" }
    }
  },
  GLUE: {
    COLD: { sapCode: "1004557", description: "Cold Melt Adhesive" },
    HOT: { sapCode: "1004555", description: "Hot Melt Adhesive" }
  },
  HANDLE: {
    FLAT: { sapCode: "1003688", description: "Flat Paper Handle" },
    TWISTED: { sapCode: "1003967", description: "Twisted Paper Handle" }
  },
  PATCH: {
    FLAT: { sapCode: "1003695", description: "Handle Patch for Flat Handles" },
    TWISTED: { sapCode: "1003948", description: "Handle Patch for Twisted Handles" }
  },
  CARTON: {
    SMALL: { sapCode: "1004232", description: "Small Carton Box" },
    MEDIUM: { sapCode: "1004289", description: "Medium Carton Box" },
    STANDARD: { sapCode: "1003530", description: "Standard Carton Box" },
    LARGE: { sapCode: "1004308", description: "Large Carton Box" }
  }
};