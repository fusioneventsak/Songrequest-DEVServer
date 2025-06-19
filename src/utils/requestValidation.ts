import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import type { User, Song, RequestFormData } from '../types';

// Define possible validation error types for better error handling
export enum ValidationErrorType {
  MISSING_USER = 'MISSING_USER',
  INVALID_USER_ID = 'INVALID_USER_ID',
  MISSING_SONG = 'MISSING_SONG',
  INVALID_SONG = 'INVALID_SONG',
  INVALID_DATA = 'INVALID_DATA',
  SERVER_ERROR = 'SERVER_ERROR'
}

// Detailed validation error response
export interface ValidationErrorResponse {
  type: ValidationErrorType;
  message: string;
  field?: string;
  suggestion?: string;
  data?: any;
}

// Successful validation response
export interface ValidationSuccessResponse {
  valid: true;
  requestId?: string;
}

// Combined response type
export type ValidationResponse = ValidationSuccessResponse | ValidationErrorResponse;

/**
 * Validates user song request against multiple criteria
 */
export async function validateUserRequest(
  user: User | null | undefined,
  song: Song | null | undefined,
  formData: RequestFormData | null | undefined
): Promise<ValidationResponse> {
  const logPrefix = `[RequestValidation][${uuidv4().slice(0, 8)}]`;
  
  try {
    // 1. Validate user exists
    if (!user) {
      const error = {
        type: ValidationErrorType.MISSING_USER,
        message: 'User is required for making a request',
        suggestion: 'Please ensure you are logged in before making a request'
      };
      console.error(`${logPrefix} ${error.type}: ${error.message}`);
      return error;
    }

    // 2. Validate user has required fields
    if (!user.name || !user.photo) {
      const error = {
        type: ValidationErrorType.INVALID_USER_ID,
        message: 'User profile is incomplete',
        field: !user.name ? 'name' : 'photo',
        suggestion: 'Please complete your profile before making a request'
      };
      console.error(`${logPrefix} ${error.type}: ${error.message}, missing ${error.field}`);
      return error;
    }

    // 3. Validate song exists
    if (!song) {
      const error = {
        type: ValidationErrorType.MISSING_SONG,
        message: 'No song selected',
        suggestion: 'Please select a song before submitting your request'
      };
      console.error(`${logPrefix} ${error.type}: ${error.message}`);
      return error;
    }

    // 4. Validate song has required fields
    if (!song.id || !song.title) {
      const error = {
        type: ValidationErrorType.INVALID_SONG,
        message: 'Selected song is invalid',
        field: !song.id ? 'id' : 'title',
        suggestion: 'Please select a different song',
        data: { songId: song.id, title: song.title }
      };
      console.error(`${logPrefix} ${error.type}: ${error.message}, invalid song data:`, error.data);
      return error;
    }

    // 5. Validate form data
    if (!formData) {
      const error = {
        type: ValidationErrorType.INVALID_DATA,
        message: 'Request form data is missing',
        suggestion: 'Please fill out the request form completely'
      };
      console.error(`${logPrefix} ${error.type}: ${error.message}`);
      return error;
    }

    if (!formData.title || !formData.requestedBy || !formData.userPhoto) {
      const missingFields = [];
      if (!formData.title) missingFields.push('title');
      if (!formData.requestedBy) missingFields.push('requestedBy');
      if (!formData.userPhoto) missingFields.push('userPhoto');
      
      const error = {
        type: ValidationErrorType.INVALID_DATA,
        message: 'Request form is incomplete',
        field: missingFields.join(', '),
        suggestion: 'Please ensure all required fields are filled out',
        data: { formData: { ...formData, userPhoto: formData.userPhoto ? '[DATA]' : undefined } }
      };
      console.error(`${logPrefix} ${error.type}: ${error.message}, missing fields: ${error.field}`);
      return error;
    }

    // Check for existing requests for this song (to add user to existing request)
    try {
      const { data: existingRequests, error: requestsError } = await supabase
        .from('requests')
        .select('id, title')
        .eq('title', song.title)
        .eq('is_played', false)
        .limit(1);

      if (requestsError) throw requestsError;

      // If we found an existing request, return its ID so the user can be added to it
      if (existingRequests && existingRequests.length > 0) {
        return { valid: true, requestId: existingRequests[0].id };
      }

      // All validation passed
      return { valid: true };
    } catch (error) {
      console.error(`${logPrefix} Database error during validation:`, error);
      return {
        type: ValidationErrorType.SERVER_ERROR,
        message: 'Error checking for existing requests',
        suggestion: 'Please try again later',
        data: { error }
      };
    }
  } catch (unexpectedError) {
    // Catch any unexpected errors in the validation process itself
    console.error(`${logPrefix} Unexpected validation error:`, unexpectedError);
    return {
      type: ValidationErrorType.SERVER_ERROR,
      message: 'An unexpected error occurred during validation',
      suggestion: 'Please try again or contact support if the problem persists',
      data: { error: String(unexpectedError) }
    };
  }
}

/**
 * Utility function to handle validation results
 */
export function handleValidationResult(
  result: ValidationResponse,
  onSuccess: (requestId?: string) => void,
  onError: (error: ValidationErrorResponse) => void
): void {
  if ('valid' in result && result.valid) {
    onSuccess(result.requestId);
  } else {
    onError(result as ValidationErrorResponse);
  }
}