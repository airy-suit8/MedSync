#!/usr/bin/env python3
"""
ML Model Inference Script for MedSync
This script loads a trained ML model and processes medical images.
"""

import sys
import json
import pickle
import numpy as np
from PIL import Image
import os
import traceback

def load_model(model_path):
    """
    Load your trained model from pickle file
    Update this function based on your model's loading requirements
    """
    try:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        return model
    except Exception as e:
        raise Exception(f"Failed to load model: {str(e)}")

def preprocess_image(image_path):
    """
    Preprocess image for your model
    Update this function based on your model's preprocessing requirements
    """
    try:
        img = Image.open(image_path).convert('RGB')  # Convert to RGB
        img = img.resize((150, 150))  # Resize to 150x150
        img_array = np.array(img).astype(np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        raise Exception(f"Failed to preprocess image: {str(e)}")

def predict(model, image_array, test_type):
    """
    Make prediction using your model
    Update this function based on your model's prediction format
    """
    try:
        # Make prediction (adjust based on your model's predict method)
        prediction = model.predict(image_array, verbose=0)  # Suppress verbose output
        
        # Convert prediction to appropriate format
        # This is a generic example - modify based on your model's output
        if hasattr(prediction, 'shape') and len(prediction.shape) > 1:
            # If prediction is 2D, take the first row
            prediction = prediction[0]
        
        # Convert to float if it's not already
        if isinstance(prediction, np.ndarray):
            prediction = prediction.astype(float)
        
        return prediction
        
    except Exception as e:
        raise Exception(f"Failed to make prediction: {str(e)}")

def format_results(prediction, test_type):
    """
    Format prediction results based on test type
    Update this function based on your model's output format and requirements
    """
    try:
        # Get the main prediction value
        if isinstance(prediction, (list, np.ndarray)):
            main_prediction = float(prediction[0]) if len(prediction) > 0 else 0.0
        else:
            main_prediction = float(prediction)
        
        # Ensure prediction is between 0 and 1
        main_prediction = max(0.0, min(1.0, main_prediction))
        
        # Format results based on test type
        if test_type == "x_ray":
            if main_prediction > 0.8:
                findings = "High probability of bone fracture or significant abnormality detected"
                severity = "moderate"
                recommendations = "Immediate orthopedic consultation and follow-up X-ray recommended"
            elif main_prediction > 0.6:
                findings = "Possible bone fracture or abnormality detected"
                severity = "mild"
                recommendations = "Orthopedic evaluation and follow-up imaging in 1 week"
            elif main_prediction > 0.4:
                findings = "Minor bone abnormalities or stress fractures possible"
                severity = "mild"
                recommendations = "Consider orthopedic consultation and repeat X-ray if symptoms persist"
            else:
                findings = "Normal bone structure, no fractures detected"
                severity = "normal"
                recommendations = "Continue routine monitoring"
                
        elif test_type == "blood_test":
            if main_prediction > 0.8:
                findings = "Significant blood cell abnormalities detected"
                severity = "moderate"
                recommendations = "Immediate blood work repeat and clinical evaluation"
            elif main_prediction > 0.6:
                findings = "Elevated blood cell counts detected"
                severity = "mild"
                recommendations = "Repeat blood test in 1 week"
            elif main_prediction > 0.4:
                findings = "Minor blood cell variations detected"
                severity = "mild"
                recommendations = "Monitor and repeat if symptoms persist"
            else:
                findings = "Normal blood test results"
                severity = "normal"
                recommendations = "Continue routine monitoring"
                
        elif test_type == "ct_scan":
            if main_prediction > 0.8:
                findings = "Significant bone or tissue abnormalities detected in CT scan"
                severity = "moderate"
                recommendations = "Immediate radiological review and orthopedic consultation"
            elif main_prediction > 0.6:
                findings = "Possible bone or tissue abnormalities in CT scan"
                severity = "mild"
                recommendations = "Radiological review and orthopedic evaluation recommended"
            else:
                findings = "Normal CT scan appearance"
                severity = "normal"
                recommendations = "Routine follow-up as clinically indicated"
                
        elif test_type == "mri":
            if main_prediction > 0.8:
                findings = "Significant bone or soft tissue findings detected in MRI"
                severity = "moderate"
                recommendations = "Immediate radiological review and orthopedic consultation required"
            elif main_prediction > 0.6:
                findings = "Possible bone or soft tissue abnormalities in MRI"
                severity = "mild"
                recommendations = "Radiological review and orthopedic evaluation recommended"
            else:
                findings = "Normal MRI appearance"
                severity = "normal"
                recommendations = "Continue current management"
                
        elif test_type == "ultrasound":
            if main_prediction > 0.8:
                findings = "Significant ultrasound findings detected"
                severity = "moderate"
                recommendations = "Immediate clinical review recommended"
            elif main_prediction > 0.6:
                findings = "Possible ultrasound abnormalities"
                severity = "mild"
                recommendations = "Follow-up ultrasound recommended"
            else:
                findings = "Normal ultrasound appearance"
                severity = "normal"
                recommendations = "Routine follow-up imaging as needed"
                
        elif test_type == "ecg":
            if main_prediction > 0.8:
                findings = "Significant ECG abnormalities detected"
                severity = "moderate"
                recommendations = "Immediate cardiac evaluation recommended"
            elif main_prediction > 0.6:
                findings = "Possible ECG abnormalities"
                severity = "mild"
                recommendations = "Cardiac monitoring and follow-up ECG"
            else:
                findings = "Normal sinus rhythm, no significant ST changes"
                severity = "normal"
                recommendations = "Continue current management"
                
        else:  # Default for other test types
            findings = "Analysis completed successfully"
            severity = "normal" if main_prediction < 0.5 else "mild"
            recommendations = "Review results and follow up as clinically indicated"
        
        return {
            "findings": findings,
            "confidence": main_prediction,
            "recommendations": recommendations,
            "severity": severity
        }
        
    except Exception as e:
        raise Exception(f"Failed to format results: {str(e)}")

def main():
    """
    Main function to process command line arguments and run inference
    """
    if len(sys.argv) != 3:
        error_result = {"error": "Invalid arguments. Usage: python ml_inference.py <image_path> <test_type>"}
        print(json.dumps(error_result))
        sys.exit(1)
    
    image_path = sys.argv[1]
    test_type = sys.argv[2]
    
    try:
        # Validate inputs
        if not os.path.exists(image_path):
            raise Exception(f"Image file not found: {image_path}")
        
        # Define model path (update this path to your actual model file)
        model_path = os.path.join(os.path.dirname(__file__), "..", "models", "bone_fracture_model.pkl")
        
        # Check if model file exists
        if not os.path.exists(model_path):
            # For testing, return mock results
            print(json.dumps({
                "findings": f"Mock analysis for {test_type} - Model file not found",
                "confidence": 0.75,
                "recommendations": "Please place your model.pkl file in the models directory",
                "severity": "mild"
            }))
            return
        
        # Load model
        model = load_model(model_path)
        
        # Preprocess image
        image_array = preprocess_image(image_path)
        
        # Make prediction
        prediction = predict(model, image_array, test_type)
        
        # Format results
        result = format_results(prediction, test_type)
        
        # Return results as JSON
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "traceback": traceback.format_exc() if "--debug" in sys.argv else None
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main() 