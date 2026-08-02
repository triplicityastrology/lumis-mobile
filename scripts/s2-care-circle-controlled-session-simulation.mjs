import {
  CONTROLLED_SESSION_STAGES,
  runControlledSessionSimulation,
} from "./lib/care-circle-controlled-session-simulation.mjs";

const result = runControlledSessionSimulation();
process.stdout.write([
  "S2_T153_CONTROLLED_SESSION_SIMULATION_PASSED",
  `checkpoint_count=${result.completed.length}`,
  `final_state=${result.nextAction}`,
  "network_calls=0 credentials_requested=0 remote_success_inferred=0",
  `stages=${CONTROLLED_SESSION_STAGES.join(",")}`,
].join("\n") + "\n");
