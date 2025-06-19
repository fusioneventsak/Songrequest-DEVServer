// Circuit breaker states
enum CircuitState {
  CLOSED, // Normal operation, requests flow through
  OPEN,   // Circuit tripped, all requests fail fast
  HALF_OPEN // Testing if the service has recovered
}

// Configuration for different services
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

// Default configuration
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,    // Number of failures before opening circuit
  resetTimeout: 30000,    // Time in ms to wait before trying again (30s)
  halfOpenRequests: 3     // Number of requests to try in half-open state
};

// Service-specific configurations
const SERVICE_CONFIGS: Record<string, CircuitBreakerConfig> = {
  'songs': {
    failureThreshold: 10,
    resetTimeout: 60000,  // 1 minute
    halfOpenRequests: 2
  },
  'requests': {
    failureThreshold: 10,    // Increased threshold
    resetTimeout: 15000,     // Shorter timeout for faster recovery
    halfOpenRequests: 2      // Allow more test requests
  },
  'setLists': {
    failureThreshold: 8,
    resetTimeout: 45000,  // 45 seconds
    halfOpenRequests: 2
  }
};

/**
 * Circuit breaker implementation to prevent cascading failures
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private nextAttempt: number = Date.now();
  private readonly config: CircuitBreakerConfig;
  private lastError: Error | null = null;
  
  constructor(private readonly service: string) {
    this.config = SERVICE_CONFIGS[service] || DEFAULT_CONFIG;
  }
  
  /**
   * Execute operation with circuit breaker pattern
   */
  public async execute<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    // If signal is already aborted, fail fast
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }
    
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Service ${this.service} is unavailable (circuit open). Next attempt at ${new Date(this.nextAttempt).toLocaleTimeString()}`);
      }
      this.halfOpen();
    }
    
    try {
      // Check for abort signal again before executing operation
      if (signal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      // Don't record failures for aborted operations
      if (error instanceof Error && 
          (error.name === 'AbortError' || 
           error.message.includes('aborted') || 
           error.message.includes('Component unmounted'))) {
        throw error; // Re-throw but don't record as circuit failure
      }
      
      this.recordFailure(error);
      this.lastError = error instanceof Error ? error : new Error(String(error));
      throw this.lastError;
    }
  }
  
  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.halfOpenRequests) {
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failures = 0;
    }
  }
  
  /**
   * Record a failed operation
   */
  private recordFailure(error: unknown): void {
    this.failures++;
    
    if (this.state === CircuitState.HALF_OPEN || 
        (this.state === CircuitState.CLOSED && this.failures >= this.config.failureThreshold)) {
      this.trip();
    }
  }
  
  /**
   * Trip the circuit to OPEN state
   */
  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.resetTimeout;
    console.warn(`Circuit for ${this.service} tripped to OPEN state. Will retry at ${new Date(this.nextAttempt).toLocaleTimeString()}`);
  }
  
  /**
   * Set circuit to HALF_OPEN state
   */
  private halfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successes = 0;
    console.log(`Circuit for ${this.service} entering HALF-OPEN state`);
  }
  
  /**
   * Reset circuit to CLOSED state
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.lastError = null;
    console.log(`Circuit for ${this.service} reset to CLOSED state`);
  }
  
  /**
   * Get current circuit state
   */
  public getState(): string {
    return CircuitState[this.state];
  }

  /**
   * Get last error that caused circuit to open
   */
  public getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get time until next retry attempt
   */
  public getTimeUntilRetry(): number {
    return Math.max(0, this.nextAttempt - Date.now());
  }
}

// Circuit breakers for different services
const circuitBreakers: Record<string, CircuitBreaker> = {};

/**
 * Get or create a circuit breaker for a service
 */
function getCircuitBreaker(service: string): CircuitBreaker {
  if (!circuitBreakers[service]) {
    circuitBreakers[service] = new CircuitBreaker(service);
  }
  return circuitBreakers[service];
}

/**
 * Execute an operation with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
  service: string,
  operation: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  // If signal is already aborted, fail fast
  if (signal?.aborted) {
    throw new Error('Operation aborted');
  }
  
  const circuitBreaker = getCircuitBreaker(service);
  return circuitBreaker.execute(operation, signal);
}

/**
 * Reset a specific circuit breaker
 */
export function resetCircuitBreaker(service: string): void {
  const circuitBreaker = circuitBreakers[service];
  if (circuitBreaker) {
    circuitBreaker.reset();
  }
}

/**
 * Get circuit breaker status information
 */
export function getCircuitBreakerStatus(service: string): {
  state: string;
  lastError: Error | null;
  timeUntilRetry: number;
} | null {
  const circuitBreaker = circuitBreakers[service];
  if (!circuitBreaker) {
    return null;
  }

  return {
    state: circuitBreaker.getState(),
    lastError: circuitBreaker.getLastError(),
    timeUntilRetry: circuitBreaker.getTimeUntilRetry()
  };
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  Object.values(circuitBreakers).forEach(breaker => breaker.reset());
}