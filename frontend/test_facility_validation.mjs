import test from "node:test";
import assert from "node:assert/strict";

// Import the validator using tsx or direct relative path with node experimental strip types or module
import {
  validateSpaceFacilityCapacity,
  DEFAULT_FACILITY_AREA_CATALOGUE,
} from "./src/lib/facility-capacity-validator.ts";

test("Scenario A: Small room with reasonable facilities (5 m², 1 compact WC + 1 shower)", () => {
  const space = {
    id: "space-1",
    name: "Ensuite Bathroom",
    category: "Rest Room / Changing Room",
    area: 5,
    restroomSubCategories: {
      toiletPrivateContinuous: 1,
      showerContinuous: 1,
    },
  };

  const result = validateSpaceFacilityCapacity(space);
  // 1 private WC = 1.75 m², 1 shower = 1.85 m² -> Total = 3.60 m² <= 5 m²
  assert.equal(result.status, "valid");
  assert.equal(result.hasWarning, false);
  assert.equal(result.availableArea, 5);
  assert.equal(result.estimatedRequiredArea, 3.6);
  assert.equal(result.excessArea, 0);
  assert.equal(result.utilizationPercent, 72);
});

test("Scenario B: Small room with excessive facilities (5 m², multiple WCs, showers, lockers, changing, janitor)", () => {
  const space = {
    id: "space-2",
    name: "Overcrowded Bathroom",
    category: "Rest Room / Changing Room",
    area: 5,
    restroomSubCategories: {
      toiletPrivateContinuous: 1, // 1.75
      toiletPublicContinuous: 1,  // 2.15
      showerContinuous: 2,        // 2 * 1.85 = 3.70
      janitorCloset: 1,           // 2.25
      changingPositions: 1,       // 2.00
      lockerRoom: 1,              // 1.40
    },
  };

  const result = validateSpaceFacilityCapacity(space);
  // Total = 1.75 + 2.15 + 3.70 + 2.25 + 2.00 + 1.40 = 13.25 m²
  assert.equal(result.status, "over_capacity");
  assert.equal(result.hasWarning, true);
  assert.equal(result.availableArea, 5);
  assert.equal(result.estimatedRequiredArea, 13.25);
  assert.equal(result.excessArea, 8.25);
  assert.equal(result.utilizationPercent, 265);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].code, "AREA_CAPACITY_EXCEEDED");
  assert.match(result.tooltipText, /Facility capacity warning/);
  assert.match(result.tooltipText, /Estimated utilization: 265%/);
});

test("Scenario C: Excessive changing positions (10 m², 10 changing positions)", () => {
  const space = {
    id: "space-3",
    name: "Small Changing Room",
    category: "Rest Room / Changing Room",
    area: 10,
    restroomSubCategories: {
      changingPositions: 10,
    },
  };

  const result = validateSpaceFacilityCapacity(space);
  // 10 positions * 2.00 m² = 20.0 m² > 10.0 m²
  assert.equal(result.status, "over_capacity");
  assert.equal(result.hasWarning, true);
  assert.equal(result.availableArea, 10);
  assert.equal(result.estimatedRequiredArea, 20);
  assert.equal(result.excessArea, 10);
  assert.equal(result.utilizationPercent, 200);
});

test("Scenario D: Larger room (100 m², 10 changing positions)", () => {
  const space = {
    id: "space-4",
    name: "Large Changing Facility",
    category: "Rest Room / Changing Room",
    area: 100,
    restroomSubCategories: {
      changingPositions: 10,
    },
  };

  const result = validateSpaceFacilityCapacity(space);
  // 20 m² <= 100 m² -> 20% utilization
  assert.equal(result.status, "valid");
  assert.equal(result.hasWarning, false);
  assert.equal(result.availableArea, 100);
  assert.equal(result.estimatedRequiredArea, 20);
  assert.equal(result.excessArea, 0);
  assert.equal(result.utilizationPercent, 20);
});

test("Scenario E: Unit conversion (equivalent results in m² and ft²)", () => {
  // 50 m² vs equivalent in ft² (50 / 0.09290304 = 538.1955 ft²)
  const spaceM2 = {
    id: "space-m2",
    area: 10,
    restroomSubCategories: {
      changingPositions: 10, // 20 m² -> 200% over capacity
    },
  };

  const spaceFt2 = {
    id: "space-ft2",
    area: 10 / 0.09290304, // 107.639 ft²
    restroomSubCategories: {
      changingPositions: 10,
    },
  };

  const resultM2 = validateSpaceFacilityCapacity(spaceM2, undefined, { unit: "m2" });
  const resultFt2 = validateSpaceFacilityCapacity(spaceFt2, undefined, { unit: "ft2" });

  assert.equal(resultM2.hasWarning, true);
  assert.equal(resultFt2.hasWarning, true);
  assert.equal(resultM2.utilizationPercent, resultFt2.utilizationPercent);
  assert.equal(resultM2.status, resultFt2.status);
});

test("Scenario F: Continuous/discontinuous classification", () => {
  // Case 1: Alternative classifications of the same 2 fixtures (mode: alternative_max)
  const spaceAlternative = {
    id: "space-f1",
    area: 10,
    restroomSubCategories: {
      toiletPrivateContinuous: 2,
      toiletPrivateDiscontinuous: 2,
      showerContinuous: 1,
      showerDiscontinuous: 1,
    },
  };

  const resultAlt = validateSpaceFacilityCapacity(spaceAlternative, undefined, {
    classificationMode: "alternative_max",
  });
  // Max(2, 2) * 1.75 + Max(1, 1) * 1.85 = 3.5 + 1.85 = 5.35 m²
  assert.equal(resultAlt.estimatedRequiredArea, 5.35);
  const wcItemAlt = resultAlt.breakdown.find((b) => b.facilityKey === "toiletPrivate");
  assert.equal(wcItemAlt?.physicalCount, 2);
  assert.equal(wcItemAlt?.isContinuousDiscontinuousMerged, true);

  // Case 2: Genuinely separate physical fixtures (mode: additive)
  const resultAdditive = validateSpaceFacilityCapacity(spaceAlternative, undefined, {
    classificationMode: "additive",
  });
  // (2 + 2) * 1.75 + (1 + 1) * 1.85 = 7.0 + 3.7 = 10.7 m²
  assert.equal(resultAdditive.estimatedRequiredArea, 10.7);
  const wcItemAdd = resultAdditive.breakdown.find((b) => b.facilityKey === "toiletPrivate");
  assert.equal(wcItemAdd?.physicalCount, 4);
  assert.equal(resultAdditive.hasWarning, true); // 10.7 > 10.0
});

test("Scenario G: Live update simulation (increasing/decreasing quantities and area)", () => {
  let space = {
    id: "space-g",
    area: 5,
    restroomSubCategories: {
      toiletPrivateContinuous: 2, // 2 * 1.75 = 3.5 <= 5 m²
    },
  };

  let res = validateSpaceFacilityCapacity(space);
  assert.equal(res.hasWarning, false);

  // User increases quantity to 4 toilets (4 * 1.75 = 7.0 > 5 m²)
  space = {
    ...space,
    restroomSubCategories: {
      toiletPrivateContinuous: 4,
    },
  };
  res = validateSpaceFacilityCapacity(space);
  assert.equal(res.hasWarning, true);
  assert.equal(res.status, "over_capacity");

  // User increases room area to 12 m²
  space = {
    ...space,
    area: 12,
  };
  res = validateSpaceFacilityCapacity(space);
  assert.equal(res.hasWarning, false);
  assert.equal(res.status, "valid");
});

test("Scenario H: Invalid and edge data handling", () => {
  // 1. Missing room area
  const resMissingArea = validateSpaceFacilityCapacity({ area: undefined, restroomSubCategories: { janitorCloset: 2 } });
  assert.equal(resMissingArea.status, "invalid_area");
  assert.equal(resMissingArea.hasWarning, false); // Must not falsely report over-capacity
  assert.equal(resMissingArea.utilizationPercent, 0);

  // 2. Zero room area
  const resZeroArea = validateSpaceFacilityCapacity({ area: 0, restroomSubCategories: { showerContinuous: 1 } });
  assert.equal(resZeroArea.status, "invalid_area");
  assert.equal(resZeroArea.hasWarning, false);

  // 3. Negative room area
  const resNegArea = validateSpaceFacilityCapacity({ area: -15, restroomSubCategories: { toiletPublicContinuous: 1 } });
  assert.equal(resNegArea.status, "invalid_area");
  assert.equal(resNegArea.hasWarning, false);

  // 4. Missing facility configuration (empty space)
  const resEmpty = validateSpaceFacilityCapacity({ area: 25 });
  assert.equal(resEmpty.status, "no_facilities");
  assert.equal(resEmpty.hasWarning, false);
  assert.equal(resEmpty.estimatedRequiredArea, 0);

  // 5. Zero facility quantities
  const resZeroQty = validateSpaceFacilityCapacity({
    area: 25,
    restroomSubCategories: {
      toiletPrivateContinuous: 0,
      toiletPublicContinuous: 0,
      showerContinuous: 0,
    },
  });
  assert.equal(resZeroQty.status, "no_facilities");
  assert.equal(resZeroQty.hasWarning, false);
  assert.equal(resZeroQty.estimatedRequiredArea, 0);

  // 6. Null space
  const resNull = validateSpaceFacilityCapacity(null);
  assert.equal(resNull.status, "no_facilities");
  assert.equal(resNull.hasWarning, false);
});

test("Scenario I: Existing functionality (minimum fresh air, extract air, and balancing remain untouched)", async () => {
  const { calculateVentilation } = await import("./src/lib/ventilation-calc.ts");

  const initialSpaces = [
    {
      id: "sp-1",
      code: "SP-001",
      name: "Office Space",
      building: "Tower A",
      floor: "L01",
      zone: "Zone 1",
      category: "Office space",
      area: 50,
      occupancy: 5,
      freshAir: 0,
      extractAir: 0,
      pressure: "Neutral",
      equipment: "",
      status: "draft",
      multiplier: 1,
    },
    {
      id: "sp-2",
      code: "SP-002",
      name: "Restroom Suite",
      building: "Tower A",
      floor: "L01",
      zone: "Zone 1",
      category: "Rest Room / Changing Room",
      area: 5, // 5 m²
      occupancy: 0,
      freshAir: 0,
      extractAir: 0,
      pressure: "Negative",
      equipment: "",
      status: "draft",
      multiplier: 1,
      restroomSubCategories: {
        toiletPrivateContinuous: 1, // 12.5 L/s
        showerContinuous: 1,        // 10.0 L/s
      },
    },
  ];

  const initialZones = [
    {
      id: "zone-1",
      name: "Zone 1",
      building: "Tower A",
      floor: "L01",
      spaceCount: 2,
      area: 55,
      freshAir: 0,
      extractAir: 0,
      pressure: 0,
      equipment: [],
      pressureType: "neutral",
    },
  ];

  const initialEquipment = [];

  // Clone before running calculation
  const beforeSpaces = JSON.parse(JSON.stringify(initialSpaces));

  // Run calculation
  const calculated = calculateVentilation(initialSpaces, initialZones, initialEquipment);

  // Validate facility capacity on sp-2
  const valResult = validateSpaceFacilityCapacity(calculated.spaces[1]);
  assert.equal(valResult.hasWarning, false); // 1 private WC (1.75) + 1 shower (1.85) = 3.6 m² <= 5 m²

  // Restroom minOA must be 0, minExt must be ceil(12.5 + 10.0) = 23 (or multiple of 5 after balancing)
  const restroomSpace = calculated.spaces.find((s) => s.id === "sp-2");
  assert.equal(restroomSpace?.minOA, 0);
  assert.equal(restroomSpace?.minExt, 23);

  // Inputs must NOT have been mutated
  assert.deepEqual(initialSpaces, beforeSpaces);
});

