# HFL-NodeJS
Hierarchical Federated Learning implementation is NodeJS. Created by David Canaday to aide an undergraduate research program at Colorado School of Mines.

# Usage Instructions
0. Ensure you are running NodeJS 18.X.X or above!
1. Run `npm i`
2. Run "start_central.bat" and "start_client_server.bat"
3. Run "start_edge.bat" as many times as needed and specify a port each time.
4. Run "start_client.bat" and specify port of edge server to connect to.
5. Run "start_sim.bat"

# Progress
This implementation is designed to be a demo to run on the local machine, but the code is applicable to a more realistic situation where the network is distributed across many devices. The connectivity is nearly fully implemented. The main features that still need to be added are: robustness and error handling, sending model back upstream for learning iterations, and better train data dissemenation to clients (current method doesn't work well with larger batches).
