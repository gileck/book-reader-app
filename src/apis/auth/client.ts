import apiClient, { ApiOptions } from '@/client/utils/apiClient';
import {
    login,
    logout,
    me,
    register,
    updateProfile
} from './index';
import {
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RegisterRequest,
    RegisterResponse,
    CurrentUserResponse,
    UpdateProfileRequest,
    UpdateProfileResponse
} from './types';

export const apiLogin = (params: LoginRequest) => {
    return apiClient.call<LoginResponse, LoginRequest>(login, params);
};

export const apiRegister = (params: RegisterRequest) => {
    return apiClient.call<RegisterResponse, RegisterRequest>(register, params);
};

export const apiFetchCurrentUser = (options?: ApiOptions) => {
    return apiClient.call<CurrentUserResponse>(me, {}, options);
};

export const apiLogout = () => {
    return apiClient.call<LogoutResponse>(logout, {});
};

export const apiUpdateProfile = (params: UpdateProfileRequest, options?: ApiOptions) => {
    return apiClient.call<UpdateProfileResponse, UpdateProfileRequest>(updateProfile, params, options);
}; 