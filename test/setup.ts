// Global test setup: install a baseline chrome mock so modules that touch
// chrome.* at call time don't throw. Individual specs call installChromeMock()
// in beforeEach for a fresh, inspectable store.
import { installChromeMock } from './chrome-mock';

installChromeMock();
