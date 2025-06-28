# Models Directory

This directory is where you should place your trained ML model files.

## File Structure

```
models/
├── README.md
├── your_model.pkl          # Your trained model file
└── requirements.txt        # Python dependencies for your model
```

## Setup Instructions

1. **Place your model file**: Copy your trained pickle model to this directory
2. **Rename the file**: Rename your model file to `your_model.pkl` or update the path in `scripts/ml_inference.py`
3. **Update dependencies**: Create a `requirements.txt` file with your model's Python dependencies

## Example Model File

If your model file is named `chest_xray_classifier.pkl`, you can either:

**Option 1: Rename the file**
```bash
mv chest_xray_classifier.pkl your_model.pkl
```

**Option 2: Update the script path**
Edit `scripts/ml_inference.py` and change line 147:
```python
model_path = os.path.join(os.path.dirname(__file__), "..", "models", "chest_xray_classifier.pkl")
```

## Python Dependencies

Create a `requirements.txt` file with your model's dependencies:

```txt
numpy>=1.21.0
Pillow>=8.0.0
scikit-learn>=1.0.0
tensorflow>=2.8.0
# Add other dependencies your model requires
```

## Testing Your Model

You can test your model independently:

```bash
# From the project root
python scripts/ml_inference.py path/to/test/image.jpg x_ray
```

## Security Note

- **Never commit your model files to version control**
- Add `*.pkl` to your `.gitignore` file
- Keep your model files secure and backed up separately

## Model Format Requirements

Your model should:
- Be saved as a pickle file (`.pkl`)
- Have a `.predict()` method that accepts numpy arrays
- Return predictions in a format that can be converted to float

## Troubleshooting

If you encounter issues:

1. **Model loading errors**: Check file path and pickle format
2. **Prediction errors**: Verify your model's predict method signature
3. **Memory issues**: Ensure your model can handle the input image size
4. **Dependency errors**: Install required Python packages

## Example Model Integration

Here's how to integrate a simple scikit-learn model:

```python
# In your training script
import pickle
from sklearn.ensemble import RandomForestClassifier

# Train your model
model = RandomForestClassifier()
model.fit(X_train, y_train)

# Save the model
with open('models/your_model.pkl', 'wb') as f:
    pickle.dump(model, f)
```

The inference script will automatically load and use your model when processing uploaded images. 