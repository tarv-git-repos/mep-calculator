export interface OccupancyData {
  category: string;
  peopleOA: number;
  areaOA: number;
  defaultDensity: number;
  exhaustPerUnit: number;
  exhaustPerArea: number;
  ach: number;
  airClass: number | string;
}

export const ASHRAE_OCCUPANCY_DATA: OccupancyData[] = [
  {
    category: "EX. Arenas",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 2.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Art classroom",
    peopleOA: 5.0,
    areaOA: 0.9,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 3.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Auditorium seating area",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 150.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Auto repair rooms",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 150.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 7.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Bank vault / safe deposit",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 5.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Banks or bank lobbies",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 15.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Barbershop",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 2.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Barracks sleeping areas",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Bars / cocktail lounges",
    peopleOA: 3.8,
    areaOA: 0.9,
    defaultDensity: 100.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Beauty and nail salon",
    peopleOA: 10.0,
    areaOA: 0.6,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 3.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Bedroom",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Living room",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Booking / waiting",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 50.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Bowling alley (seating)",
    peopleOA: 5.0,
    areaOA: 0.6,
    defaultDensity: 40.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Break rooms (general)",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Breakrooms (office buildings)",
    peopleOA: 2.5,
    areaOA: 0.6,
    defaultDensity: 50.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Cafeteria / fast food dining",
    peopleOA: 3.8,
    areaOA: 0.9,
    defaultDensity: 100.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Cell",
    peopleOA: 2.5,
    areaOA: 0.6,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Cell with toilet",
    peopleOA: 2.5,
    areaOA: 0.6,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 5.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Classrooms (age 9 plus)",
    peopleOA: 5.0,
    areaOA: 0.6,
    defaultDensity: 35.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Classrooms (ages 5-8)",
    peopleOA: 5.0,
    areaOA: 0.6,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Coffee stations",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Coin-operated laundries",
    peopleOA: 3.8,
    areaOA: 0.6,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Elevator",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 555.5,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Computer (not printing)",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 4.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Computer lab",
    peopleOA: 5.0,
    areaOA: 0.6,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Conference / meeting",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 50.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "EX. Copy, printing rooms",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 2.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Corridors",
    peopleOA: 0.0,
    areaOA: 0.3,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Courtrooms",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 70.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "EX. Chemical storage rooms",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 7.5,
    ach: 0.0,
    airClass: 4
  },
  {
    category: "EX. Darkrooms",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 5.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Day room",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 30.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Daycare (through age 4)",
    peopleOA: 5.0,
    areaOA: 0.9,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Daycare sickroom",
    peopleOA: 5.0,
    areaOA: 0.9,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 3
  },
  {
    category: "Disco / dance floors",
    peopleOA: 10.0,
    areaOA: 0.3,
    defaultDensity: 100.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Dwelling unit",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Electrical equipment rooms",
    peopleOA: 0.0,
    areaOA: 0.3,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Elevator machine rooms",
    peopleOA: 0.0,
    areaOA: 0.6,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Freezer and refrigerated spaces <50 deg F",
    peopleOA: 5.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 3
  },
  {
    category: "Gambling casinos",
    peopleOA: 3.8,
    areaOA: 0.9,
    defaultDensity: 120.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Game arcades",
    peopleOA: 3.8,
    areaOA: 0.9,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "General manufacturing",
    peopleOA: 5.0,
    areaOA: 0.9,
    defaultDensity: 7.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Guard stations",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 15.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Gym, sports arena (play area)",
    peopleOA: 10.0,
    areaOA: 0.9,
    defaultDensity: 7.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Health club / aerobics",
    peopleOA: 10.0,
    areaOA: 0.3,
    defaultDensity: 40.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Health club / weight",
    peopleOA: 10.0,
    areaOA: 0.3,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "EX. Janitor closets, trash rooms, recycling",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 5.0,
    ach: 0.0,
    airClass: 3
  },
  {
    category: "Kitchenettes",
    peopleOA: 3.8,
    areaOA: 0.6,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 1.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Kitchen - Commercial",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 60.0,
    airClass: 2
  },
  {
    category: "Kitchen - Residential",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 5.0,
    airClass: 2
  },
  {
    category: "Laundry rooms - dwelling units",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 1.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Laundry rooms - public",
    peopleOA: 2.5,
    areaOA: 0.6,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 1.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Lecture classroom",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 65.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Lecture hall (fixed seats)",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 150.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Legislative chambers",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 50.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Libraries",
    peopleOA: 2.5,
    areaOA: 0.6,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Lobbies",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 150.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Lobbies / prefunction",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 30.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "EX. Locker rooms",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 1.25,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Main entry lobbies",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Mall common areas",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 40.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Media center",
    peopleOA: 5.0,
    areaOA: 0.6,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Multi-purpose assembly",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 120.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Multi-use assembly",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 100.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Museums (children's)",
    peopleOA: 3.8,
    areaOA: 0.6,
    defaultDensity: 40.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Museums / galleries",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 40.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Music / theater/ dance",
    peopleOA: 5.0,
    areaOA: 0.3,
    defaultDensity: 35.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Occupiable storage rooms for dry materials",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 2.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Occupiable storage rooms for liquids or gels",
    peopleOA: 2.5,
    areaOA: 0.6,
    defaultDensity: 2.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Office space",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 5.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Ex. Parking garages",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 3.7,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Pet shops (animal areas)",
    peopleOA: 3.8,
    areaOA: 0.9,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 4.5,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Pharmacy (prep, area)",
    peopleOA: 2.5,
    areaOA: 0.9,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Photo studios",
    peopleOA: 2.5,
    areaOA: 0.6,
    defaultDensity: 10.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Places of religious worship",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 120.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Reception areas",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 30.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Restaurant dining rooms",
    peopleOA: 3.8,
    areaOA: 0.9,
    defaultDensity: 70.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Sales",
    peopleOA: 3.8,
    areaOA: 0.6,
    defaultDensity: 15.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Science laboratories",
    peopleOA: 5.0,
    areaOA: 0.9,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 5.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Shipping / receiving",
    peopleOA: 5.0,
    areaOA: 0.6,
    defaultDensity: 2.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "EX. Shower rooms (continuous)",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 10.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "EX. Shower rooms (discontinuous)",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 25.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "EX. Soiled laundry storage rooms",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 5.0,
    ach: 0.0,
    airClass: 3
  },
  {
    category: "Sorting, packing, light assembly",
    peopleOA: 3.8,
    areaOA: 0.6,
    defaultDensity: 7.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Spectator areas",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 150.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Sports arena (play area)",
    peopleOA: 0.0,
    areaOA: 1.5,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Stages, studios",
    peopleOA: 5.0,
    areaOA: 0.3,
    defaultDensity: 70.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Storage rooms",
    peopleOA: 0.0,
    areaOA: 0.6,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Supermarket",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 8.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Swimming (pool & deck)",
    peopleOA: 0.0,
    areaOA: 2.4,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Telephone / data entry",
    peopleOA: 2.5,
    areaOA: 0.3,
    defaultDensity: 60.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "Telephone closets",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "EX. Toilet - private (continuous)",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 12.5,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "EX. Toilet - private (discontinuous)",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 25.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "EX. Toilet - public (continuous)",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 25.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "EX. Toilet - public (discontinuous)",
    peopleOA: 0.0,
    areaOA: 0.0,
    defaultDensity: 0.0,
    exhaustPerUnit: 35.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Transportation waiting",
    peopleOA: 3.8,
    areaOA: 0.3,
    defaultDensity: 100.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 1
  },
  {
    category: "University / college laboratories",
    peopleOA: 5.0,
    areaOA: 0.9,
    defaultDensity: 25.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Warehouses",
    peopleOA: 5.0,
    areaOA: 0.3,
    defaultDensity: 0.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 0.0,
    ach: 0.0,
    airClass: 2
  },
  {
    category: "Wood / metal shop",
    peopleOA: 5.0,
    areaOA: 0.9,
    defaultDensity: 20.0,
    exhaustPerUnit: 0.0,
    exhaustPerArea: 2.5,
    ach: 0.0,
    airClass: 2
  }
];

export function toTitleCase(str: string): string {
  if (!str) return str;
  return str.replace(/\b([a-z])([a-z]*)\b/gi, (match, p1, p2) => {
    const upper = match.toUpperCase();
    if (upper === "EX" || upper === "WC" || upper === "OA" || upper === "ACH" || upper === "HVAC" || upper === "L" || upper === "S") {
      return upper;
    }
    return p1.toUpperCase() + p2.toLowerCase();
  });
}

// Convert all categories in database to Title Case dynamically
ASHRAE_OCCUPANCY_DATA.forEach(d => {
  d.category = toTitleCase(d.category);
});

export function getOccupancyCategories(): string[] {
  const cats = ASHRAE_OCCUPANCY_DATA.map(d => d.category);
  cats.push("Rest Room / Changing Room");
  
  const excluded = [
    "EX. Shower rooms (continuous)",
    "EX. Shower rooms (discontinuous)",
    "EX. Toilet - private (continuous)",
    "EX. Toilet - private (discontinuous)",
    "EX. Toilet - public (continuous)",
    "EX. Toilet - public (discontinuous)"
  ].map(s => s.toLowerCase());

  const filtered = cats.filter(c => !excluded.includes(c.toLowerCase()));
  return filtered.sort((a, b) => getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)));
}

export function getOccupancyData(category: string): OccupancyData | null {
  const normalized = toTitleCase(category);
  if (normalized === "Rest Room / Changing Room" || category === "Rest Room / Changing Room") {
    return {
      category: "Rest Room / Changing Room",
      peopleOA: 0.0,
      areaOA: 0.0,
      defaultDensity: 0.0,
      exhaustPerUnit: 0.0,
      exhaustPerArea: 0.0,
      ach: 0.0,
      airClass: 2
    };
  }
  return ASHRAE_OCCUPANCY_DATA.find(d => d.category === normalized || d.category === category) || null;
}

export function getOutdoorAirRates(category: string): { peopleOA: number; areaOA: number } {
  const data = getOccupancyData(category);
  if (!data) return { peopleOA: 0, areaOA: 0 };
  return { peopleOA: data.peopleOA, areaOA: data.areaOA };
}

export function getExhaustData(category: string): { exhaustPerUnit: number; exhaustPerArea: number; ach: number } {
  const data = getOccupancyData(category);
  if (!data) return { exhaustPerUnit: 0, exhaustPerArea: 0, ach: 0 };
  return { exhaustPerUnit: data.exhaustPerUnit, exhaustPerArea: data.exhaustPerArea, ach: data.ach };
}

export function getCategoryDisplayName(c: string): string {
  return c || "";
}
