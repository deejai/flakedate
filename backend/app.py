from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
import os
from datetime import datetime
import uuid
import secrets
import smtplib
from email.mime.text import MIMEText
from email.utils import make_msgid, formataddr

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'flakedate.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Event(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(500), nullable=False)
    email1 = db.Column(db.String(120), nullable=False)
    email2 = db.Column(db.String(120), nullable=False)
    token1 = db.Column(db.String(64), unique=True, nullable=False)
    token2 = db.Column(db.String(64), unique=True, nullable=False)
    user1_flake = db.Column(db.Boolean, default=False)
    user2_flake = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'description': self.description,
            'email1': self.email1,
            'email2': self.email2,
            'user1_flake': self.user1_flake,
            'user2_flake': self.user2_flake
        }

def generate_unique_token():
    while True:
        token = secrets.token_urlsafe(48)
        if not Event.query.filter_by(token1=token).first() and not Event.query.filter_by(token2=token).first():
            return token

def send_email(to_email, subject, message):
    from_email = 'noreply@flakedate.com'
    msg = MIMEText(message)
    msg['Subject'] = subject
    msg['From'] = formataddr(("FlakeDate", from_email))
    msg['To'] = to_email
    msg['Message-ID'] = make_msgid()

    try:
        with smtplib.SMTP('localhost') as server:
            server.sendmail(from_email, [to_email], msg.as_string())
        print(f"{datetime.now()}: Sent email to {to_email}")
        return True
    except Exception as e:
        print(f"{datetime.now()}: Error sending email to {to_email}: {e}")
        return False

@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.json
    try:
        new_event = Event(
            id=str(uuid.uuid4()),
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            description=data['description'],
            email1=data['email1'],
            email2=data['email2'],
            token1=generate_unique_token(),
            token2=generate_unique_token()
        )
        db.session.add(new_event)
        db.session.commit()

        # Send emails to both participants
        base_url = request.host_url.rstrip('/')
        for i, email in enumerate([new_event.email1, new_event.email2], start=1):
            token = getattr(new_event, f'token{i}')
            subject = "You've been invited to a FlakeDate event!"
            message = f"""
            Hello!

            You've been invited to a FlakeDate event on {new_event.date.strftime('%B %d, %Y')}.

            Event description: {new_event.description}

            To view and manage your event, please visit this link:
            {base_url}/event/{token}

            Remember, this link is secret and unique to you. Don't share it with anyone else!

            Best regards,
            The FlakeDate Team
            """
            send_email(email, subject, message)

        return jsonify({
            'eventId': new_event.id,
            'secretLink1': f"/event/{new_event.token1}",
            'secretLink2': f"/event/{new_event.token2}"
        }), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to create event'}), 400

@app.route('/api/events/<token>/status', methods=['GET'])
def check_status(token):
    event = Event.query.filter((Event.token1 == token) | (Event.token2 == token)).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    is_user1 = token == event.token1
    is_user2 = token == event.token2
    
    return jsonify({
        'flakeStatus': {
            'user1': event.user1_flake,
            'user2': event.user2_flake
        },
        'isUser1': is_user1,
        'isUser2': is_user2,
        'eventDetails': {
            'date': event.date.isoformat(),
            'description': event.description
        }
    })

@app.route('/api/events/<token>/toggle', methods=['POST'])
def toggle_flake(token):
    event = Event.query.filter((Event.token1 == token) | (Event.token2 == token)).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    if token == event.token1:
        event.user1_flake = not event.user1_flake
        current_user_email = event.email1
        other_user_email = event.email2
    elif token == event.token2:
        event.user2_flake = not event.user2_flake
        current_user_email = event.email2
        other_user_email = event.email1
    else:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.commit()
    
    if event.user1_flake and event.user2_flake:
        subject = "FlakeDate Update: Both parties are feeling flakey!"
        message = f"""
        Hello!

        We wanted to let you know that both you and the other participant for the event on {event.date.strftime('%B %d, %Y')} are feeling flakey.

        Event description: {event.description}

        You might want to consider rescheduling or confirming your plans.

        Best regards,
        The FlakeDate Team
        """
        send_email(event.email1, subject, message)
        send_email(event.email2, subject, message)
    else:
        subject = "FlakeDate Update: Flake status changed"
        message = f"""
        Hello!

        The flake status for your event on {event.date.strftime('%B %d, %Y')} has been updated.

        Event description: {event.description}

        You can check the current status by visiting your event page.

        Best regards,
        The FlakeDate Team
        """
        send_email(other_user_email, subject, message)
    
    return jsonify({
        'flakeStatus': {
            'user1': event.user1_flake,
            'user2': event.user2_flake
        }
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
