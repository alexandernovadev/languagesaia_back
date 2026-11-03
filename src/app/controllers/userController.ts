import { Request, Response } from "express";
import { UserService } from "../services/users/userService";

import { successResponse, errorResponse } from "../utils/responseHelpers";
import { toUserDTO, mapPaginated } from "../dto/mappers";
import { validateJsonBuffer, MAX_IMPORT_ITEMS } from "../middlewares/uploadMiddleware";
import { routeParams } from "../utils/http/routeParams";

const userService = new UserService();

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getUsers(req.query);
    return successResponse(res, "Users listed successfully", mapPaginated(users, toUserDTO));
  } catch (error) {
    return errorResponse(res, "Error listing users", 500, error);
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(routeParams(req).id);
    if (!user) return errorResponse(res, "User not found", 404);
    return successResponse(res, "User found", toUserDTO(user));
  } catch (error) {
    return errorResponse(res, "Error getting user", 500, error);
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.createUser(
      req.body,
      req,
      req.user?._id?.toString()
    );
    return successResponse(res, "User created successfully", toUserDTO(user), 201);
  } catch (error) {
    return errorResponse(res, "Error creating user", 400, error);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.updateUser(
      routeParams(req).id,
      req.body,
      req,
      req.user?._id?.toString()
    );
    if (!user) return errorResponse(res, "User not found", 404);
    return successResponse(res, "User updated successfully", toUserDTO(user));
  } catch (error) {
    return errorResponse(res, "Error updating user", 400, error);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.deleteUser(
      routeParams(req).id,
      req,
      req.user?._id?.toString()
    );
    if (!user) return errorResponse(res, "User not found", 404);
    return successResponse(res, "User deleted successfully", toUserDTO(user));
  } catch (error) {
    return errorResponse(res, "Error deleting user", 400, error);
  }
};

// Export all users to JSON
export const exportUsersToJSON = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsersForExport();

    // Set headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `users-export-${timestamp}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Send the JSON data
    return successResponse(res, `Exported ${users.length} users successfully`, {
      totalUsers: users.length,
      exportDate: new Date().toISOString(),
      users,
    });
  } catch (error: any) {
    return errorResponse(
      res,
      "An error occurred while exporting users to JSON",
      500,
      error
    );
  }
};

// Import users from JSON file
export const importUsersFromFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return errorResponse(res, "No file uploaded", 400);
    }

    // Validate file content before parsing (MIME type is spoofable)
    if (!validateJsonBuffer(req.file.buffer)) {
      return errorResponse(res, "File content is not valid JSON", 400);
    }

    // Parse the JSON file content
    let fileData: any;
    try {
      const fileContent = req.file.buffer.toString("utf-8");
      fileData = JSON.parse(fileContent);
    } catch (parseError) {
      return errorResponse(res, "Invalid JSON file format", 400);
    }

    // Validate file structure
    if (
      !fileData.data ||
      !fileData.data.users ||
      !Array.isArray(fileData.data.users)
    ) {
      return errorResponse(
        res,
        "Invalid file structure. Expected 'data.users' array",
        400
      );
    }

    const users = fileData.data.users;

    if (users.length > MAX_IMPORT_ITEMS) {
      return errorResponse(res, `Import exceeds maximum of ${MAX_IMPORT_ITEMS} items per request`, 400);
    }
    const {
      duplicateStrategy = "skip",
      validateOnly = false,
      batchSize = 10,
    } = req.query;

    // Validate duplicateStrategy
    const validStrategies = ["skip", "overwrite", "error", "merge"];
    if (!validStrategies.includes(duplicateStrategy as string)) {
      return errorResponse(
        res,
        `Invalid duplicateStrategy. Must be one of: ${validStrategies.join(
          ", "
        )}`,
        400
      );
    }

    // Validate batchSize
    const batchSizeNum = parseInt(batchSize as string);
    if (isNaN(batchSizeNum) || batchSizeNum < 1 || batchSizeNum > 100) {
      return errorResponse(
        res,
        "Invalid batchSize. Must be a number between 1 and 100",
        400
      );
    }

    // Convert validateOnly to boolean
    const validateOnlyBool = validateOnly === "true";

    // If validateOnly is true, just validate without importing
    if (validateOnlyBool) {
      const validationResults = users.map((user: any, index: number) => ({
        index,
        data: user,
        status: user.email && user.username ? "valid" : "invalid",
        errors: !user.email
          ? ["Email is required"]
          : !user.username
          ? ["Username is required"]
          : [],
      }));

      const validCount = validationResults.filter(
        (r: any) => r.status === "valid"
      ).length;
      const invalidCount = validationResults.filter(
        (r: any) => r.status === "invalid"
      ).length;

      return successResponse(res, "Validation completed", {
        totalUsers: users.length,
        valid: validCount,
        invalid: invalidCount,
        validationResults,
        message: `Validation completed. ${validCount} valid, ${invalidCount} invalid`,
      });
    }

    // Import users
    const importResult = await userService.importUsers(users, {
      duplicateStrategy: duplicateStrategy as
        | "skip"
        | "overwrite"
        | "error"
        | "merge",
      batchSize: batchSizeNum,
    });

    return successResponse(res, "Import completed successfully", importResult);
  } catch (error: any) {
    return errorResponse(
      res,
      "An error occurred while importing users",
      500,
      error
    );
  }
};
