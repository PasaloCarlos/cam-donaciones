import { Database } from "./database";

export type { Database };

// Enum unions
export type { DonationSource, PledgeStatus, PledgeKind, DonationGoal } from "./database";

// Row aliases
export type Donor = Database["public"]["Tables"]["donors"]["Row"];
export type Pledge = Database["public"]["Tables"]["pledges"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type ImportBatch = Database["public"]["Tables"]["import_batches"]["Row"];
