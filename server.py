from flask import Flask, request, jsonify
from flask_cors import CORS
from logic import GraphVerifierEngine

app = Flask(__name__)
CORS(app)

@app.route('/api/verify', methods=['POST'])
def verify():
    data = request.json
    try:
        num_vertices = data.get('num_vertices', 0)
        edges = data.get('edges', [])
        problem = data.get('problem')
        k = data.get('k', 0)
        candidate = data.get('candidate', [])

        engine = GraphVerifierEngine(num_vertices, edges)
        
        if problem == 'clique':
            is_valid, msg = engine.verify_clique(candidate, k)
        elif problem == 'vc':
            is_valid, msg = engine.verify_vertex_cover(candidate, k)
        else:
            return jsonify({'error': 'Invalid problem type'}), 400

        return jsonify({'is_valid': is_valid, 'message': msg})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
